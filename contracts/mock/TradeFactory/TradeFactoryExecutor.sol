// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryExecutor.sol';
import './TradeFactoryPositionsHandler.sol';

contract TradeFactoryExecutorMock is TradeFactoryPositionsHandlerMock, TradeFactoryExecutor {
  constructor(
    address _masterAdmin, 
    address _swapperAdder, 
    address _swapperSetter, 
    address _strategyAdder, 
    address _mechanicsRegistry
  ) 
    TradeFactoryPositionsHandlerMock(_masterAdmin, _swapperAdder, _swapperSetter, _strategyAdder)
    TradeFactoryExecutor(_mechanicsRegistry) {}

  function enableSwapperToken(address _swapper, address _token) external {
    _enableSwapperToken(_swapper, _token);
  }
}
