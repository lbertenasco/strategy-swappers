// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '../../TradeFactory/TradeFactorySwapperHandler.sol';

contract TradeFactorySwapperHandlerMock is TradeFactorySwapperHandler {
  using EnumerableSet for EnumerableSet.AddressSet;
  
  constructor(address _governor) TradeFactorySwapperHandler() TradeFactoryAccessManager(_governor) {}

  function addSwapperInternal(address _swapper) external {
    _swappers.add(_swapper);
  }

  function removeSwapperInternal(address _swapper) external {
    _swappers.remove(_swapper);
  }

}
