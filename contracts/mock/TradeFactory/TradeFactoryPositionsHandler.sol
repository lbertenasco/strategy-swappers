// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryPositionsHandler.sol';
import './TradeFactorySwapperHandler.sol';

contract TradeFactoryPositionsHandlerMock is TradeFactorySwapperHandlerMock, TradeFactoryPositionsHandler {
  constructor(address _governor) TradeFactorySwapperHandlerMock(_governor) {}

  function removePendingTrade(address _strategy, uint256 _id) external {
    _removePendingTrade(_strategy, _id);
  }
}
