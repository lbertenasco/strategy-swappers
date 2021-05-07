// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import './OTCPoolDesk.sol';
import './OTCPoolTradeable.sol';

interface IOTCPool is IOTCPoolTradeable {}

contract OTCPoolis is IOTCPool, OTCPoolDesk, OTCPoolTradeable {
  constructor(address _OTCProvider, address _swapperRegistry) OTCPoolDesk(_OTCProvider) OTCPoolTradeable(_swapperRegistry) {}

  // TODO: Only governance
  function setOTCProvider(address _OTCProvider) external override {
    _setOTCProvider(_OTCProvider);
  }

  // TODO: Only governance
  function setSwapperRegistry(address _swapperRegistry) external override {
    _setSwapperRegistry(_swapperRegistry);
  }

  function deposit(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amount
  ) external override onlyOTCProvider {
    _deposit(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amount);
  }

  function withdraw(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToWithdraw
  ) external override onlyOTCProvider {
    _withdraw(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amountToWithdraw);
  }

  // OTC Pool Tradeable
  function claim(address _token, uint256 _amountToClaim) external override onlyOTCProvider {
    _claim(msg.sender, _token, _amountToClaim);
  }

  function takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) external override onlyRegisteredSwapper returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    (_tookFromPool, _tookFromSwapper) = _performTradeOnSwapper(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _maxOfferedAmount);
  }
}
