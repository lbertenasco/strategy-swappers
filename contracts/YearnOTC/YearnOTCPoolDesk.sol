// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

interface IYearnOTCPoolDesk {
  event OTCProviderSet(address _OTCProvider);
  event Deposited();

  function OTCProvider() external view returns (address);

  function availableFor(address _offeredToken, address _wantedtoken) external view returns (uint256 _offeredAmount);

  function setOTCProvider(address _OTCProvider) external;

  function deposit(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amount
  ) external;

  function withdraw(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amount
  ) external;
}

abstract contract YearnOTCPoolDesk is IYearnOTCPoolDesk {
  using SafeERC20 for IERC20;

  address public override OTCProvider;
  mapping(address => mapping(address => uint256)) public override availableFor;

  constructor(address _OTCProvider) {
    _setOTCProvider(_OTCProvider);
  }

  function _setOTCProvider(address _OTCProvider) internal {
    require(_OTCProvider != address(0), 'YearnOTCPool: zero address');
    OTCProvider = _OTCProvider;
    emit OTCProviderSet(_OTCProvider);
  }

  modifier onlyOTCProvider {
    require(msg.sender == OTCProvider, 'YearnOTCPool: unauthorized');
    _;
  }

  function _deposit(
    address _from,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToOffer
  ) internal {
    require(_from != address(0), 'YearnOTCPool: provider should not be zero');
    require(_offeredTokenToPool != address(0) && _wantedTokenFromPool != address(0), 'YearnOTCPool: tokens should not be zero');
    require(_amountToOffer > 0, 'YearnOTCPool: should provide more than zero');
    IERC20(_offeredTokenToPool).safeTransferFrom(msg.sender, address(this), _amountToOffer);
    _addAvailableFor(_offeredTokenToPool, _wantedTokenFromPool, _amountToOffer);
    emit Deposited();
  }

  function _addAvailableFor(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToOffer
  ) internal {
    availableFor[_offeredTokenToPool][_wantedTokenFromPool] += _amountToOffer;
  }

  function _withdraw(
    address _receiver,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToWithdraw
  ) internal {
    require(_receiver != address(0), 'YearnOTCPool: to should not be zero');
    require(_offeredTokenToPool != address(0) && _wantedTokenFromPool != address(0), 'YearnOTCPool: tokens should not be zero');
    require(_amountToWithdraw > 0, 'YearnOTCPool: should provide more than zero');
    _reduceAvailableFor(_offeredTokenToPool, _wantedTokenFromPool, _amountToWithdraw);
    IERC20(_offeredTokenToPool).safeTransfer(_receiver, _amountToWithdraw);
  }

  function _reduceAvailableFor(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToWithdraw
  ) internal {
    require(availableFor[_offeredTokenToPool][_wantedTokenFromPool] >= _amountToWithdraw, 'YearnOTCPool: not enough provided');
    availableFor[_offeredTokenToPool][_wantedTokenFromPool] -= _amountToWithdraw;
  }
}
