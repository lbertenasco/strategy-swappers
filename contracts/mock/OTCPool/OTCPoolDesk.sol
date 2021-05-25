// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../OTCPool/OTCPoolDesk.sol';

contract OTCPoolDeskMock is OTCPoolDesk {

  constructor(address _OTCProvider) OTCPoolDesk(_OTCProvider) {}

  function onlyOTCProviderModifier() onlyOTCProvider external {}

  function setOTCProvider(address _OTCProvider) external override {
    _setOTCProvider(_OTCProvider);
  }

  function setAvailableFor(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToOffer
  ) external {
    availableFor[_offeredTokenToPool][_wantedTokenFromPool] = _amountToOffer;
  }

  function depositInternal(
    address _depositor,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToOffer
  ) external {
    _deposit(_depositor, _offeredTokenToPool, _wantedTokenFromPool, _amountToOffer);
  }

  function deposit(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToOffer
  ) external override {
    _deposit(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amountToOffer);
  }

  function withdrawInternal(
    address _receiver,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToWithdraw
  ) external {
    _withdraw(_receiver, _offeredTokenToPool, _wantedTokenFromPool, _amountToWithdraw);
  }
  
  function withdraw(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToWithdraw
  ) external override {
    _withdraw(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amountToWithdraw);
  }
}
