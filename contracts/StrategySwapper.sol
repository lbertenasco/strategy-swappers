// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IStrategySwapper {
  function swap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256);

  function claim() external returns (uint256);

  function swapAndClaim(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256);
}
