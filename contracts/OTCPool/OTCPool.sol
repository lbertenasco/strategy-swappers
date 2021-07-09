// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../utils/CollectableDustWithTokensManagement.sol';
import './OTCPoolTradeable.sol';
import './OTCPoolDesk.sol';

interface IOTCPool is IOTCPoolTradeable {}

contract OTCPool is IOTCPool, CollectableDustWithTokensManagement, Governable, OTCPoolDesk, OTCPoolTradeable {
  constructor(
    address _governor,
    address _OTCProvider,
    address _swapperRegistry
  ) Governable(_governor) OTCPoolDesk(_OTCProvider) OTCPoolTradeable(_swapperRegistry) {}

  // OTC Pool Tradeable
  function setSwapperRegistry(address _swapperRegistry) external override onlyGovernor {
    _setSwapperRegistry(_swapperRegistry);
  }

  function claim(address _token, uint256 _amountToClaim) external override onlyOTCProvider {
    _claim(msg.sender, _token, _amountToClaim);
    _subTokenUnderManagement(_token, _amountToClaim);
  }

  function takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) external override onlyRegisteredSwapper returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    (_tookFromPool, _tookFromSwapper) = _takeOffer(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _maxOfferedAmount);
    _subTokenUnderManagement(_wantedTokenFromPool, _tookFromPool);
    _addTokenUnderManagement(_offeredTokenToPool, _tookFromSwapper);
  }

  // Governable
  function setPendingGovernor(address _pendingGovernor) external override onlyGovernor {
    _setPendingGovernor(_pendingGovernor);
  }

  function acceptGovernor() external override onlyPendingGovernor {
    _acceptGovernor();
  }

  // CollectableDustWithTokenManagement
  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
