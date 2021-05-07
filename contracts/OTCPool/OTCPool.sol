// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol';
import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';

import './OTCPoolTradeable.sol';
import './OTCPoolDesk.sol';

interface IOTCPool is IOTCPoolTradeable {}

contract OTCPool is IOTCPool, OTCPoolDesk, OTCPoolTradeable, Governable, CollectableDust {
  constructor(
    address _governor,
    address _OTCProvider,
    address _swapperRegistry
  ) Governable(_governor) OTCPoolDesk(_OTCProvider) OTCPoolTradeable(_swapperRegistry) {}

  // OTC Pool Desk
  function setOTCProvider(address _OTCProvider) external override onlyGovernor {
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
  function setSwapperRegistry(address _swapperRegistry) external override onlyGovernor {
    _setSwapperRegistry(_swapperRegistry);
  }

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

  // Governable
  function setPendingGovernor(address _pendingGovernor) external override onlyGovernor {
    _setPendingGovernor(_pendingGovernor);
  }

  function acceptGovernor() external override onlyPendingGovernor {
    _acceptGovernor();
  }

  // Collectable dust
  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external virtual override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
