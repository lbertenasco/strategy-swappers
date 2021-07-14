// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryExecutor.sol';

import './TradeFactoryPositionsHandler.sol';

contract TradeFactoryExecutorMock is TradeFactoryPositionsHandler, TradeFactoryExecutor {
  constructor(address _swapperRegistry, address _mechanicsRegistry) TradeFactoryPositionsHandler(_swapperRegistry) TradeFactoryExecutor(_mechanicsRegistry) {}

  function setMechanicsRegistry(address _mechanicsRegistry) external override {
    _setMechanicsRegistry(_mechanicsRegistry);
  }

  function enableSwapperToken(address _swapper, address _token) external {
    _enableSwapperToken(_swapper, _token);
  }

}