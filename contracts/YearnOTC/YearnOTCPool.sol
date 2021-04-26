// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

interface IYearnOTCPool {
  event OTCProviderSet(address _OTCProvider);
  event Deposited();
  event Claimed();

  function OTCProvider() external view returns (address);

  function availableFor(address _offeredToken, address _wantedtoken) external view returns (uint256 _offeredAmount);

  function swappedAvailable(address _swappedToken) external view returns (uint256 _swappedAmount);

  function setOTCProvider(address _OTCProvider) external;

  function deposit(
    address _offeredToken,
    address _wantedToken,
    uint256 _amount
  ) external;

  function withdraw(
    address _offeredToken,
    address _wantedToken,
    uint256 _amount
  ) external;

  function claim(address _token, uint256 _amount) external;
}

contract YearnOTCPool is IYearnOTCPool {
  using SafeERC20 for IERC20;

  address public override OTCProvider;
  mapping(address => mapping(address => uint256)) public override availableFor;
  mapping(address => uint256) public override swappedAvailable;

  function setOTCProvider(address _OTCProvider) external virtual override onlyOTCProvider {
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

  function deposit(
    address _offeredToken,
    address _wantedToken,
    uint256 _amount
  ) external virtual override onlyOTCProvider {
    _deposit(msg.sender, _offeredToken, _wantedToken, _amount);
  }

  function _deposit(
    address _from,
    address _offeredToken,
    address _wantedToken,
    uint256 _amountToOffer
  ) internal {
    require(_from != address(0), 'YearnOTCPool: provider should not be zero');
    require(_offeredToken != address(0) && _wantedToken != address(0), 'YearnOTCPool: tokens should not be zero');
    require(_amountToOffer > 0, 'YearnOTCPool: should provide more than zero');
    IERC20(_offeredToken).safeTransferFrom(msg.sender, address(this), _amountToOffer);
    _addToPool(_offeredToken, _wantedToken, _amountToOffer);
    emit Deposited();
  }

  function _addToPool(
    address _offeredToken,
    address _wantedToken,
    uint256 _amountToOffer
  ) internal {
    availableFor[_offeredToken][_wantedToken] += _amountToOffer;
  }

  function withdraw(
    address _offeredToken,
    address _wantedToken,
    uint256 _amountToWithdraw
  ) external virtual override onlyOTCProvider {
    _withdraw(msg.sender, _offeredToken, _wantedToken, _amountToWithdraw);
  }

  function _withdraw(
    address _receiver,
    address _offeredToken,
    address _wantedToken,
    uint256 _amountToWithdraw
  ) internal {
    require(_receiver != address(0), 'YearnOTCPool: to should not be zero');
    require(_offeredToken != address(0) && _wantedToken != address(0), 'YearnOTCPool: tokens should not be zero');
    require(_amountToWithdraw > 0, 'YearnOTCPool: should provide more than zero');
    _takeFromPool(_offeredToken, _wantedToken, _amountToWithdraw);
    IERC20(_offeredToken).safeTransfer(_receiver, _amountToWithdraw);
  }

  function _takeFromPool(
    address _offeredToken,
    address _wantedToken,
    uint256 _amountToWithdraw
  ) internal {
    require(availableFor[_wantedToken][_offeredToken] >= _amountToWithdraw, 'YearnOTCPool: not enough provided');
    availableFor[_offeredToken][_wantedToken] -= _amountToWithdraw;
  }

  function claim(address _token, uint256 _amountToClaim) external virtual override onlyOTCProvider {
    _claim(msg.sender, _token, _amountToClaim);
  }

  function _claim(
    address _receiver,
    address _token,
    uint256 _amountToClaim
  ) internal {
    require(_receiver != address(0), 'YearnOTCPool: receiver should not be zero');
    require(_token != address(0), 'YearnOTCPool: token should not be zero');
    require(_amountToClaim > 0, 'YearnOTCPool: should provide more than zero');
    _claim(_token, _amountToClaim);
    IERC20(_token).safeTransfer(_receiver, _amountToClaim);
    emit Claimed();
  }

  function _claim(address _token, uint256 _amountToClaim) internal {
    require(_amountToClaim >= swappedAvailable[_token], 'YearnOTCPool: swapped not available');
    swappedAvailable[_token] -= _amountToClaim;
  }
}
