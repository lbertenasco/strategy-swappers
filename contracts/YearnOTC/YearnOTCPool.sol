// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import './YearnOTCPoolDesk.sol';
import './YearnOTCPoolTradeable.sol';

interface IYearnOTCPool is IYearnOTCPoolTradeable {}

contract YearnOTCPoolis is IYearnOTCPool, YearnOTCPoolDesk, YearnOTCPoolTradeable {
  constructor(address _OTCProvider, address _swapperRegistry) YearnOTCPoolDesk(_OTCProvider) YearnOTCPoolTradeable(_swapperRegistry) {}

  // OTC Pool Desk

  // TODO: Only governance
  function setOTCProvider(address _OTCProvider) external override {
    _setOTCProvider(_OTCProvider);
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
  ) public override returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    require(SwapperRegistry(swapperRegistry).isSwapper(msg.sender));
    (_tookFromPool, _tookFromSwapper) = _performTradeOnSwapper(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _maxOfferedAmount);
  }
}
