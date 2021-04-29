// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

interface IMechanicsRegistry {
  function addMechanic(address _mechanic) external;

  function removeMechanic(address _mechanic) external;

  function mechanics() external view returns (address[] memory _mechanicsList);

  function isMechanic(address mechanic) external view returns (bool _isMechanic);
}

interface IMachinery {
  function mechanicsRegistry() external view returns (address);

  function setMechanicsRegistry(address _mechanicsRegistry) external;

  function isMechanic(address mechanic) external view returns (bool _isMechanic);
}

abstract contract Machinery is IMachinery {
  using EnumerableSet for EnumerableSet.AddressSet;

  address public override mechanicsRegistry;

  constructor(address _mechanicsRegistry) {
    _setMechanicsRegistry(_mechanicsRegistry);
  }

  function _setMechanicsRegistry(address _mechanicsRegistry) internal {
    mechanicsRegistry = _mechanicsRegistry;
  }

  function isMechanic(address _mechanic) public view override returns (bool _isMechanic) {
    return IMechanicsRegistry(mechanicsRegistry).isMechanic(_mechanic);
  }

  modifier onlyMechanic {
    require(IMechanicsRegistry(mechanicsRegistry).isMechanic(msg.sender));
    _;
  }
}
