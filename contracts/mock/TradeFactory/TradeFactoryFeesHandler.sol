// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryFeesHandler.sol';

contract TradeFactoryFeesHandlerMock is TradeFactoryFeesHandler {
  using SafeERC20 for IERC20;

  constructor(address _governor) TradeFactoryFeesHandler(_governor) {}

  function setStrategySwapper(
    address _strategy,
    address _swapper,
    bool _migrateSwaps
  ) external override onlyRole(SWAPPER_SETTER) returns (uint256[] memory _changedSwapperIds) {
    _migrateSwaps;
    _changedSwapperIds;
    _setStrategySwapper(_strategy, _swapper);
  }

  function processFees(
    address _swapper,
    address _tokenIn,
    uint256 _amountIn
  ) external returns (uint256 _feeAmount) {
    _feeAmount = (_amountIn * swapperFee[_swapper]) / (PRECISION * 100);
    if (_feeAmount > 0) IERC20(_tokenIn).safeTransfer(feeReceiver, _feeAmount);
  }
}
