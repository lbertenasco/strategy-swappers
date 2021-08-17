// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryPositionsHandler.sol';
import './TradeFactorySwapperHandler.sol';

contract TradeFactoryPositionsHandlerMock is TradeFactorySwapperHandlerMock, TradeFactoryPositionsHandler {
  constructor(
    address _masterAdmin, 
    address _swapperAdder, 
    address _swapperSetter, 
    address _strategyAdder
  ) TradeFactoryPositionsHandler(_strategyAdder) TradeFactorySwapperHandlerMock(_masterAdmin, _swapperAdder, _swapperSetter) {}

  function removePendingTrade(address _strategy, uint256 _id) external {
    _removePendingTrade(_strategy, _id);
  }
}
