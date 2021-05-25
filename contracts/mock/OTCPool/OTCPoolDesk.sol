// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../OTCPool/OTCPoolDesk.sol';

contract OTCPoolDeskMock is OTCPoolDesk {

  constructor(address _OTCProvider) OTCPoolDesk(_OTCProvider) {}

  function onlyOTCProviderModifier() onlyOTCProvider external {}

  function setOTCProvider(address _OTCProvider) external override {
    _setOTCProvider(_OTCProvider);
  }

  function deposit(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToOffer
  ) external override {
    _deposit(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amountToOffer);
  }
  
  function withdraw(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToWithdraw
  ) external override {
    _withdraw(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amountToWithdraw);
  }
}
