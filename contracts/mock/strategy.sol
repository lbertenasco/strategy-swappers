// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../utils/SwapperEnabled.sol';

contract Strategy is SwapperEnabled {
  using SafeERC20 for IERC20;

  constructor(address _tradeFactory) SwapperEnabled(_tradeFactory) {

  }

  // onlyMultisig:
  function setTradeFactory(address _tradeFactory) external override {
    _setTradeFactory(_tradeFactory);
  }

  // onlyStrategist or multisig:
  function setSwapper(string calldata _swapper, bool _migrateSwaps) external override {
    _setSwapper(_swapper, _migrateSwaps);
  }

  // onlyMultisig or internal use:
  function createTrade(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override returns (uint256 _id) {
    return _createTrade(swapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  // onlyMultisig:
  function setSwapperCheckpoint(uint256 _checkpoint) external override {
    _setSwapperCheckpoint(_checkpoint);
  }

  // onlyStrategist or multisig:
  function cancelPendingTrades(uint256[] calldata _pendingTrades) external override {
      _cancelPendingTrades(_pendingTrades);
  }

}
