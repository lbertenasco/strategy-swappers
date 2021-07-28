// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryExecutor.sol';

import './TradeFactoryPositionsHandler.sol';

contract TradeFactoryExecutorMock is TradeFactoryPositionsHandler, TradeFactoryExecutor {
  constructor(address _governor, address _mechanicsRegistry) 
    TradeFactoryExecutor(_governor, _mechanicsRegistry) {}

  function enableSwapperToken(address _swapper, address _token) external {
    _enableSwapperToken(_swapper, _token);
  }
}
