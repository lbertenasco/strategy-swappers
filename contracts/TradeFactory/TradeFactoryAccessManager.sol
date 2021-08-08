// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/access/AccessControl.sol';
import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';

abstract contract TradeFactoryAccessManager is AccessControl, Governable {
  bytes32 public constant MASTER_ADMIN = keccak256('MASTER_ADMIN');

  constructor(address _governor) Governable(_governor) {
    _setRoleAdmin(MASTER_ADMIN, MASTER_ADMIN);
    _setupRole(MASTER_ADMIN, _governor);
  }
}
