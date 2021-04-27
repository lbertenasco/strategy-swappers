// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../YearnOTCSwapper.sol';

interface IYearnOTCPool {
  event OTCProviderSet(address _OTCProvider);
  event Deposited();
  event Claimed();

  function OTCProvider() external view returns (address);

  function availableFor(address _offeredToken, address _wantedtoken) external view returns (uint256 _offeredAmount);

  function swappedAvailable(address _swappedToken) external view returns (uint256 _swappedAmount);

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
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amount
  ) external virtual override onlyOTCProvider {
    _deposit(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amount);
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
    _addToPool(_offeredTokenToPool, _wantedTokenFromPool, _amountToOffer);
    emit Deposited();
  }

  function _addToPool(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToOffer
  ) internal {
    availableFor[_offeredTokenToPool][_wantedTokenFromPool] += _amountToOffer;
  }

  function withdraw(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToWithdraw
  ) external virtual override onlyOTCProvider {
    _withdraw(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _amountToWithdraw);
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
    _takeFromPool(_offeredTokenToPool, _wantedTokenFromPool, _amountToWithdraw);
    IERC20(_offeredTokenToPool).safeTransfer(_receiver, _amountToWithdraw);
  }

  function _takeFromPool(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _amountToWithdraw
  ) internal {
    require(availableFor[_offeredTokenToPool][_wantedTokenFromPool] >= _amountToWithdraw, 'YearnOTCPool: not enough provided');
    availableFor[_offeredTokenToPool][_wantedTokenFromPool] -= _amountToWithdraw;
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

  // TODO: Discuss if this logic should be here, or should we make this calcs inside the OTC swapper
  // and trust that contract (philosophical discussion )
  function takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) public returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    // TODO: require () only in registry (only enabled and valid swappers)
    uint256 _maxWantedFromOffered = IYearnOTCSwapper(msg.sender).getTotalAmountOut(_offeredTokenToPool, _wantedTokenFromPool, _maxOfferedAmount);
    _tookFromPool = Math.min(availableFor[_wantedTokenFromPool][_offeredTokenToPool], _maxWantedFromOffered);
    _tookFromSwapper = IYearnOTCSwapper(msg.sender).getTotalAmountOut(_wantedTokenFromPool, _offeredTokenToPool, _tookFromPool);
    IERC20(_offeredTokenToPool).safeTransferFrom(msg.sender, address(this), _tookFromSwapper);
    _takeOffer(_offeredTokenToPool, _wantedTokenFromPool, _tookFromPool, _tookFromSwapper);
    // emit event();
  }

  function _takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _takenFromPool,
    uint256 _providedFromSwapper
  ) internal {
    require(_takenFromPool <= availableFor[_wantedTokenFromPool][_offeredTokenToPool], 'YearnOTCPool: amount not available');
    availableFor[_wantedTokenFromPool][_offeredTokenToPool] -= _takenFromPool;
    swappedAvailable[_offeredTokenToPool] += _providedFromSwapper;
  }
}
