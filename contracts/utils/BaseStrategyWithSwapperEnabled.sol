// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4 <0.9.0;

import './BaseStrategy.sol';
import './SwapperEnabled.sol';

abstract contract BaseStrategyWithSwapperEnabled is BaseStrategy, SwapperEnabled {
  constructor(address _vault, address _tradeFactory) BaseStrategy(_vault) SwapperEnabled(_tradeFactory) {}

  // SwapperEnabled onlyGovernance methods
  function setTradeFactory(address _tradeFactory) external override onlyGovernance {
    _setTradeFactory(_tradeFactory);
  }

  function createTrade(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override onlyGovernance returns (uint256 _id) {
    return _createTrade(_tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  // SwapperEnabled onlyAuthorized methods
  function cancelPendingTrades(uint256[] calldata _pendingTrades) external override onlyAuthorized {
    _cancelPendingTrades(_pendingTrades);
  }
}
