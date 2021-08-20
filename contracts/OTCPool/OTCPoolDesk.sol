// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';

import '../utils/CollectableDustWithTokensManagement.sol';

interface IOTCPoolDesk {
  event OTCProviderSet(address indexed _OTCProvider);
  event Deposited(address indexed _depositor, address _offeredTokenToPool, address _wantedTokenFromPool, uint256 _amountToOffer);
  event Withdrew(address indexed _receiver, address _offeredTokenToPool, address _wantedTokenFromPool, uint256 _amountToWithdraw);

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

abstract contract OTCPoolDesk is IOTCPoolDesk, CollectableDustWithTokensManagement, Governable {
  using SafeERC20 for IERC20;

  address public override OTCProvider;
  mapping(address => mapping(address => uint256)) public override availableFor;

  constructor(address _OTCProvider) {
    _setOTCProvider(_OTCProvider);
  }

  modifier onlyOTCProvider() {
    if (msg.sender != OTCProvider) revert CommonErrors.NotAuthorized();
    _;
  }

  function setOTCProvider(address _OTCProvider) external virtual override onlyGovernor {
    _setOTCProvider(_OTCProvider);
  }

  function _setOTCProvider(address _OTCProvider) internal {
    if (_OTCProvider == address(0)) revert CommonErrors.ZeroAddress();
    OTCProvider = _OTCProvider;
    emit OTCProviderSet(_OTCProvider);
  }

  function deposit(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amount
  ) public virtual override onlyOTCProvider {
    if (_offeredTokenToPool == address(0) || _wantedTokenFromPool == address(0)) revert CommonErrors.ZeroAddress();
    if (_amount == 0) revert CommonErrors.ZeroAmount();
    IERC20(_offeredTokenToPool).safeTransferFrom(msg.sender, address(this), _amount);
    availableFor[_offeredTokenToPool][_wantedTokenFromPool] += _amount;
    _addTokenUnderManagement(_offeredTokenToPool, _amount);
    emit Deposited(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amount);
  }

  function withdraw(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amount
  ) public virtual override onlyOTCProvider {
    if (_offeredTokenToPool == address(0) || _wantedTokenFromPool == address(0)) revert CommonErrors.ZeroAddress();
    if (_amount == 0) revert CommonErrors.ZeroAmount();
    require(availableFor[_offeredTokenToPool][_wantedTokenFromPool] >= _amount, 'OTCPool: not enough provided');
    availableFor[_offeredTokenToPool][_wantedTokenFromPool] -= _amount;
    IERC20(_offeredTokenToPool).safeTransfer(msg.sender, _amount);
    _subTokenUnderManagement(_offeredTokenToPool, _amount);
    emit Withdrew(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amount);
  }
}
