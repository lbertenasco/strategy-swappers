// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../OTCSwapper.sol';

contract StaticOTCSwapper is IOTCSwapper {

  mapping(address => uint256) internal _totalAmountOut;

  function SLIPPAGE_PRECISION() external view override returns (uint256) {
    return 0;
  }

  function TRADE_FACTORY() external view override returns (address) {
    return address(0);
  }

  function OTC_POOL() external view override returns (address) {
    return address(0);
  }

  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external override returns (uint256 _receivedAmount) { }

  function setTotalAmountOut(address _offeredToken, uint256 _amount) external {
    _totalAmountOut[_offeredToken] = _amount;
  }

  function getTotalAmountOut(
    address _offeredTokenToPool,
    address,
    uint256
  ) external view override returns (uint256 _amountOut) {
    _amountOut = _totalAmountOut[_offeredTokenToPool];
  }
}