import { ethers } from "hardhat"
import "@nomiclabs/hardhat-waffle"
import { expect } from "chai"
import { toWei, createContract, OrderType, assembleSubAccountId, PositionOrderFlags } from "./deployUtils"
import { Contract } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "@ethersproject/bignumber"
const U = ethers.utils

function getOrderType(orderData: string[]): number {
  // return OrderType[BigNumber.from(U.arrayify(orderData[0])[31]).toNumber()]
  return BigNumber.from(U.arrayify(orderData[0])[31]).toNumber()
}

function parsePositionOrder(orderData: string[]) {
  const arr = orderData.map((x: any) => U.arrayify(x))
  return {
    id: BigNumber.from(arr[0].slice(23, 31)).toNumber(),
    subAccountId: U.hexlify(U.concat([arr[0].slice(0, 23), U.zeroPad([], 9)])),
    collateral: BigNumber.from(arr[1].slice(0, 12)),
    size: BigNumber.from(arr[1].slice(12, 24)),
    price: BigNumber.from(arr[2].slice(0, 12)),
    profitTokenId: BigNumber.from(arr[2].slice(12, 13)),
    isMarketOrder: (BigNumber.from(arr[1].slice(24, 25)).toNumber() & 0x40) > 0,
    isIncreasing: (BigNumber.from(arr[1].slice(24, 25)).toNumber() & 0x80) > 0,
  }
}

function parseLiquidityOrder(orderData: string[]) {
  const arr = orderData.map((x: any) => U.arrayify(x))
  return {
    id: BigNumber.from(arr[0].slice(23, 31)).toNumber(),
    account: U.hexlify(arr[0].slice(0, 20)),
    amount: BigNumber.from(arr[1].slice(0, 12)),
    assetId: BigNumber.from(arr[1].slice(12, 13)).toNumber(),
    isAdding: BigNumber.from(arr[1].slice(13, 14)).toNumber() > 0,
  }
}

function parseWithdrawalOrder(orderData: string[]) {
  const arr = orderData.map((x: any) => U.arrayify(x))
  return {
    id: BigNumber.from(arr[0].slice(23, 31)).toNumber(),
    subAccountId: U.hexlify(U.concat([arr[0].slice(0, 23), U.zeroPad([], 9)])),
    amount: BigNumber.from(arr[1].slice(0, 12)),
    profitTokenId: BigNumber.from(arr[1].slice(12, 13)).toNumber(),
    isProfit: BigNumber.from(arr[1].slice(13, 14)).toNumber() > 0,
  }
}

describe("Order", () => {
  let orderBook: Contract
  let pool: Contract
  let mlp: Contract
  let atk: Contract
  let ctk: Contract

  let user0: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let user3: SignerWithAddress

  before(async () => {
    const accounts = await ethers.getSigners()
    user0 = accounts[0]
    user1 = accounts[1]
    user2 = accounts[2]
    user3 = accounts[3]
  })

  beforeEach(async () => {
    ctk = await createContract("MockERC20", ["CTK", "CTK", 18])
    atk = await createContract("MockERC20", ["ATK", "ATK", 18])
    mlp = await createContract("MockERC20", ["MLP", "MLP", 18])

    pool = await createContract("MockLiquidityPool")
    orderBook = await createContract("OrderBook")
    await orderBook.initialize(pool.address, mlp.address)
    await orderBook.addBroker(user0.address)

    await pool.setAssetAddress(0, ctk.address)
    await pool.setAssetAddress(1, atk.address)
  })

  it("placeOrder", async () => {
    {
      await ctk.approve(orderBook.address, toWei("1"))
      await ctk.mint(user0.address, toWei("1"))
      await orderBook.placePositionOrder(
        assembleSubAccountId(user0.address, 0, 1, true),
        toWei("1"),
        toWei("0.2"),
        toWei("3000"),
        1,
        PositionOrderFlags.OpenPosition
      )
      expect(await orderBook.getOrderCount()).to.equal(1)
      const result = await orderBook.getOrder(0)
      expect(result[1]).to.equal(true)
      // console.log(result[0])
      expect(getOrderType(result[0])).to.equal(OrderType.Position)
      // console.log(parsePositionOrder(result[0]))
      const order = parsePositionOrder(result[0])
      expect(order.id).to.equal(0)
      expect(order.subAccountId).to.equal(assembleSubAccountId(user0.address, 0, 1, true))
      expect(order.collateral).to.equal(toWei("1"))
      expect(order.size).to.equal(toWei("0.2"))
      expect(order.price).to.equal(toWei("3000"))
      expect(order.profitTokenId).to.equal(1)
      expect(order.isMarketOrder).to.equal(false)
      expect(order.isIncreasing).to.equal(true)

      expect(await ctk.balanceOf(user0.address)).to.equal(0)
      expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("1"))
    }
    {
      await atk.approve(orderBook.address, toWei("40"))
      await atk.mint(user0.address, toWei("40"))
      await orderBook.placeLiquidityOrder(1, toWei("40"), true)
      expect(await orderBook.getOrderCount()).to.equal(2)
      const result = await orderBook.getOrder(1)
      expect(result[1]).to.equal(true)
      // console.log(result[0])
      expect(getOrderType(result[0])).to.equal(OrderType.Liquidity)
      const order = parseLiquidityOrder(result[0])
      expect(order.id).to.equal(1)
      expect(order.account).to.equal(user0.address.toLowerCase())
      expect(order.amount).to.equal(toWei("40"))
      expect(order.assetId).to.equal(1)
      expect(order.isAdding).to.equal(true)
    }
    {
      await orderBook.placeWithdrawalOrder(assembleSubAccountId(user0.address, 0, 1, true), toWei("500"), 1, true)
      expect(await orderBook.getOrderCount()).to.equal(3)
      const result = await orderBook.getOrder(2)
      expect(result[1]).to.equal(true)
      // console.log(result[0])
      expect(getOrderType(result[0])).to.equal(OrderType.Withdrawal)
      const order = parseWithdrawalOrder(result[0])
      expect(order.id).to.equal(2)
      expect(order.subAccountId).to.equal(assembleSubAccountId(user0.address, 0, 1, true))
      expect(order.amount).to.equal(toWei("500"))
      expect(order.profitTokenId).to.equal(1)
      expect(order.isProfit).to.equal(true)
    }
  })

  it("placePositionOrder - openPosition", async () => {
    {
      await ctk.approve(orderBook.address, toWei("1000000"))
      await ctk.mint(user0.address, toWei("1000"))
      // no1
      {
        await orderBook.placePositionOrder(
          assembleSubAccountId(user0.address, 0, 1, true),
          toWei("100"),
          toWei("0.1"),
          toWei("1000"),
          0,
          PositionOrderFlags.OpenPosition
        )
        expect(await ctk.balanceOf(user0.address)).to.equal(toWei("900"))
        expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("100"))

        await orderBook.cancelOrder(0)
        expect(await ctk.balanceOf(user0.address)).to.equal(toWei("1000"))
        expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("0"))

        const result = await orderBook.getOrder(0)
        expect(result[1]).to.equal(false)
      }
      // no2
      {
        await orderBook.placePositionOrder(
          assembleSubAccountId(user0.address, 0, 1, true),
          toWei("100"),
          toWei("0.1"),
          toWei("1000"),
          0,
          PositionOrderFlags.OpenPosition
        )
        expect(await ctk.balanceOf(user0.address)).to.equal(toWei("900"))
        expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("100"))

        await orderBook.fillPositionOrder(1, toWei("2000"), toWei("1000"))
        const result = await orderBook.getOrder(1)
        expect(result[1]).to.equal(false)

        expect(await ctk.balanceOf(user0.address)).to.equal(toWei("900"))
        expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("0"))
        expect(await ctk.balanceOf(pool.address)).to.equal(toWei("100"))
      }
    }
  })

  it("placeLiquidityOrder - addLiquidity", async () => {
    {
      await ctk.approve(orderBook.address, toWei("1000000"))
      await ctk.mint(user0.address, toWei("1000"))
      // no1
      {
        await orderBook.placeLiquidityOrder(0, toWei("150"), true)
        expect(await ctk.balanceOf(user0.address)).to.equal(toWei("850"))
        expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("150"))

        await orderBook.cancelOrder(0)
        expect(await ctk.balanceOf(user0.address)).to.equal(toWei("1000"))
        expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("0"))

        const result = await orderBook.getOrder(0)
        expect(result[1]).to.equal(false)
      }
      // no2
      {
        await orderBook.placeLiquidityOrder(0, toWei("150"), true)
        expect(await ctk.balanceOf(user0.address)).to.equal(toWei("850"))
        expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("150"))

        await orderBook.fillLiquidityOrder(1, toWei("2000"), toWei("1000"))
        const result = await orderBook.getOrder(1)
        expect(result[1]).to.equal(false)

        expect(await ctk.balanceOf(user0.address)).to.equal(toWei("850"))
        expect(await ctk.balanceOf(orderBook.address)).to.equal(toWei("0"))
        expect(await ctk.balanceOf(pool.address)).to.equal(toWei("150"))
      }
    }
  })
})