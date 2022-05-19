// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./Storage.sol";
import "./Trade.sol";
import "./Getter.sol";
import "./Admin.sol";
import "../libraries/LibChainedProxy.sol";

contract LiquidityPoolHop1 is Storage, Trade, Getter, Proxy {
    event UpgradeChainedProxy(address prevNextHop, address nextHop);

    function initialize(
        address nextHop,
        address mlp,
        address orderBook,
        address liquidityManager,
        address weth,
        address nativeUnwrapper
    ) external initializer {
        __SafeOwnable_init();

        ChainedProxy.replace(nextHop);
        _storage.mlp = mlp;
        _storage.orderBook = orderBook;
        _storage.liquidityManager = liquidityManager;
        _storage.weth = weth;
        _storage.nativeUnwrapper = nativeUnwrapper;
    }

    /**
     * @dev     Upgrade LiquidityPool.
     *
     * @param   nextHop Hop2 address
     */
    function upgradeChainedProxy(address nextHop) external onlyOwner {
        emit UpgradeChainedProxy(_implementation(), nextHop);
        ChainedProxy.replace(nextHop);
    }

    /**
     * @dev     Forward unrecognized functions to the next hop
     */
    function _implementation() internal view virtual override returns (address) {
        return ChainedProxy.next();
    }
}
