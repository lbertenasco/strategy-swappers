// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../OTCPool/OTCPoolDesk.sol';

import '../utils/CollectableDustWithTokensManagement.sol';

contract OTCPoolDeskMock is OTCPoolDesk, CollectableDustWithTokensManagementMock {

  constructor(address _OTCProvider) OTCPoolDesk(_OTCProvider) Governable(msg.sender) {}

  function onlyOTCProviderModifier() onlyOTCProvider external {}

  function setAvailableFor(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToOffer
  ) external {
    availableFor[_offeredTokenToPool][_wantedTokenFromPool] = _amountToOffer;
  }
}
