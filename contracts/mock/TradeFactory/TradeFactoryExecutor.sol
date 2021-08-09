// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryExecutor.sol';

contract TradeFactoryExecutorMock is TradeFactoryExecutor {
  constructor(address _governor, address _feeReceiver, address _mechanicsRegistry) 
    TradeFactoryAccessManager(_governor)
    TradeFactoryFeesHandler(_feeReceiver)
    TradeFactoryExecutor(_mechanicsRegistry) {}

  function enableSwapperToken(address _swapper, address _token) external {
    _enableSwapperToken(_swapper, _token);
  }
}
