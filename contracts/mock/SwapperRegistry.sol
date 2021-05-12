// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../SwapperRegistry.sol';

contract SwapperRegistryMock is SwapperRegistry {

  constructor(address _governance) SwapperRegistry(_governance) {}

  function addSwapperInternal(string memory _name, address _swapper) external {
    _addSwapper(_name, _swapper);
  }

  function deprecateSwapperInternal(address _swapper) external {
    _deprecateSwapper(_swapper);
  }
}
