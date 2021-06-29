// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import './BaseStrategy.sol';
import './SwappersEnabled.sol';

abstract contract BaseStrategyWithSwappersEnabled is BaseStrategy, SwappersEnabled {
  constructor(address _vault, address _tradeFactory) BaseStrategy(_vault) SwappersEnabled(_tradeFactory) {}

  // SwapperEnabled onlyGovernance methods
  function setTradeFactory(address _tradeFactory) external override onlyGovernance {
    _setTradeFactory(_tradeFactory);
  }

  function executeTrade(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external override onlyGovernance returns (uint256 _amountOut) {
    return _executeTrade(atomicSwapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
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

  function setSwapperCheckpoint(uint256 _checkpoint) external override onlyGovernance {
    _setSwapperCheckpoint(_checkpoint);
  }

  // SwapperEnabled onlyAuthorized methods
  function setAtomicSwapper(string calldata _swapper) external override onlyAuthorized {
    _setAtomicSwapper(_swapper);
  }

  function setSwapper(string calldata _swapper, bool _migrateSwaps) external override onlyAuthorized {
    _setSwapper(_swapper, _migrateSwaps);
  }

  function cancelPendingTrades(uint256[] calldata _pendingTrades) external override onlyAuthorized {
    _cancelPendingTrades(_pendingTrades);
  }
}
