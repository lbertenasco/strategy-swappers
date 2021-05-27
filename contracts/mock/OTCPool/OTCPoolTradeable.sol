// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import './OTCPoolDesk.sol';
import '../../OTCPool/OTCPoolTradeable.sol';

contract OTCPoolTradeableMock is OTCPoolTradeable, OTCPoolDeskMock {

  bool mockedGetMaxTakeableFromPoolAndSwapper;
  uint256 tookFromPool;
  uint256 tookFromSwapper;

  constructor(address _OTCProvider, address _swapperRegistry) OTCPoolTradeable(_swapperRegistry) OTCPoolDeskMock(_OTCProvider) {}

  function onlyRegisteredSwapperModifier() external onlyRegisteredSwapper {}

  function setSwappedAvailable(
    address _token,
    uint256 _amount
  ) external {
    swappedAvailable[_token] = _amount;
  }

  function setSwapperRegistry(address _swapperRegistry) external override {
    _setSwapperRegistry(_swapperRegistry);
  }

  function claimInternal(address _receiver, address _token, uint256 _amount) external {
    _claim(_receiver, _token, _amount);
  }

  function claim(address _token, uint256 _amount) external override {
    _claim(msg.sender, _token, _amount);
  }

  function takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) external override returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    return _takeOffer(
      msg.sender,
      _offeredTokenToPool,
      _wantedTokenFromPool,
      _maxOfferedAmount
    );
  }

  function takeOfferInternal(
    address _taker,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) external returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    return _takeOffer(_taker, _offeredTokenToPool, _wantedTokenFromPool, _maxOfferedAmount);
  }

  function mockGetMaxTakeableFromPoolAndSwapper(
    uint256 _tookFromPool, 
    uint256 _tookFromSwapper
  ) external {
    mockedGetMaxTakeableFromPoolAndSwapper = true;
    tookFromPool = _tookFromPool;
    tookFromSwapper = _tookFromSwapper;
  }

  function _getMaxTakeableFromPoolAndSwapper(
    address _swapper,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) internal override view returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    if (mockedGetMaxTakeableFromPoolAndSwapper) {
      return (tookFromPool, tookFromSwapper);
    } else {
      return super._getMaxTakeableFromPoolAndSwapper(
        _swapper,
        _offeredTokenToPool,
        _wantedTokenFromPool,
        _maxOfferedAmount
      );
    }
  }

  function getMaxTakeableFromPoolAndSwapper(
    address _swapper,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) external view returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    return _getMaxTakeableFromPoolAndSwapper(_swapper, _offeredTokenToPool, _wantedTokenFromPool, _maxOfferedAmount);
  }
}
