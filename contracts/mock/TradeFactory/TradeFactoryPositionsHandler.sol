// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryPositionsHandler.sol';

contract TradeFactoryPositionsHandlerMock is TradeFactoryPositionsHandler {
  constructor(address _governor) Governable(_governor) TradeFactoryPositionsHandler() {}

  function removePendingTrade(address _strategy, uint256 _id) external {
    _removePendingTrade(_strategy, _id);
  }
}
