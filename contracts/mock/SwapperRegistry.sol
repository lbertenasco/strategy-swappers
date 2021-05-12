// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '../SwapperRegistry.sol';

contract SwapperRegistryMock is SwapperRegistry {
  using EnumerableSet for EnumerableSet.AddressSet;
  
  constructor(address _governance) SwapperRegistry(_governance) {}

  function addNameByAddress(address _address, string memory _name) external {
    nameByAddress[_address] = _name;
  }

  function addSwapperByName(string memory _name, address _address) external {
    swapperByName[_name] = _address;
  }

  function addInitializationByAddress(address _address, uint256 _initialization) external {
    initializationByAddress[_address] = _initialization;
  }

  function setDeprecatedByAddress(address _address, bool _deprecated) external {
    deprecatedByAddress[_address] = _deprecated;
  } 

  function addSwappersToSwappers(address[] memory __swappers) external {
    for (uint256 i = 0; i < __swappers.length; i++) {
      _swappers.add(__swappers[i]);
    }
  }

  function removeSwappersOfSwappers(address[] memory __swappers) external {
    for (uint256 i = 0; i < __swappers.length; i++) {
      _swappers.remove(__swappers[i]);
    }
  }

  function addSwapperInternal(string memory _name, address _swapper) external {
    _addSwapper(_name, _swapper);
  }

  function deprecateSwapperInternal(address _swapper) external {
    _deprecateSwapper(_swapper);
  }
}
