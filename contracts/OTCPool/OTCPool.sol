// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../utils/CollectableDustWithTokensManagement.sol';
import './OTCPoolTradeable.sol';
import './OTCPoolDesk.sol';

interface IOTCPool is IOTCPoolTradeable {}

contract OTCPool is IOTCPool, CollectableDustWithTokensManagement, Governable, OTCPoolDesk, OTCPoolTradeable {
  constructor(
    address _governor,
    address _tradeFactory,
    address _OTCProvider
  ) Governable(_governor) OTCPoolDesk(_OTCProvider) OTCPoolTradeable(_tradeFactory) {}

  // CollectableDustWithTokenManagement
  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
