pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockLpStake {
    address public stakeToken;
    mapping(address => uint256) public balances;

    constructor(address stakeToken_) {
        stakeToken = stakeToken_;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function stake(uint256 amount) external {
        IERC20(stakeToken).transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
    }

    function redeem(uint256 amount) external {
        balances[msg.sender] -= amount;
        IERC20(stakeToken).transfer(msg.sender, amount);
    }
}