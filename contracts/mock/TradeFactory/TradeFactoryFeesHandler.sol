// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryFeesHandler.sol';

import './TradeFactorySwapperHandler.sol';

contract TradeFactoryFeesHandlerMock is TradeFactorySwapperHandlerMock, TradeFactoryFeesHandler {
  using SafeERC20 for IERC20;

  constructor(address _governor, address _feeReceiver) TradeFactoryFeesHandler(_feeReceiver) TradeFactorySwapperHandlerMock(_governor) {}

  function processFees(
    address _swapper,
    address _tokenIn,
    uint256 _amountIn
  ) external returns (uint256 _feeAmount) {
    _feeAmount = _processFees(_swapper, _tokenIn, _amountIn);
  }
}
