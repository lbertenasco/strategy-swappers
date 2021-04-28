// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../SwapperRegistry.sol';
import '../YearnOTCSwapper.sol';
import './YearnOTCPoolDesk.sol';

interface IYearnOTCPoolTradeable {
  event Claimed();

  function swappedAvailable(address _swappedToken) external view returns (uint256 _swappedAmount);

  function claim(address _token, uint256 _amount) external;

  function takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) external returns (uint256 _tookFromPool, uint256 _tookFromSwapper);
}

abstract contract YearnOTCPoolTradeable is IYearnOTCPoolTradeable, YearnOTCPoolDesk {
  using SafeERC20 for IERC20;

  address public swapperRegistry;
  mapping(address => uint256) public override swappedAvailable;

  constructor(address _swapperRegistry) {
    swapperRegistry = _swapperRegistry;
  }

  function _claim(
    address _receiver,
    address _token,
    uint256 _amountToClaim
  ) internal {
    require(_receiver != address(0), 'YearnOTCPool: receiver should not be zero');
    require(_token != address(0), 'YearnOTCPool: token should not be zero');
    require(_amountToClaim > 0, 'YearnOTCPool: should provide more than zero');
    _reduceSwappedAvailable(_token, _amountToClaim);
    IERC20(_token).safeTransfer(_receiver, _amountToClaim);
    emit Claimed();
  }

  function _reduceSwappedAvailable(address _token, uint256 _amountToClaim) internal {
    require(_amountToClaim >= swappedAvailable[_token], 'YearnOTCPool: swapped not available');
    swappedAvailable[_token] -= _amountToClaim;
  }

  // TODO: Discuss if this logic should be here, or should we make this calcs inside the OTC swapper
  // and trust that contract (philosophical discussion)
  function _performTradeOnSwapper(
    address _swapper,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) public returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    uint256 _maxWantedFromOffered = IYearnOTCSwapper(_swapper).getTotalAmountOut(_offeredTokenToPool, _wantedTokenFromPool, _maxOfferedAmount);
    _tookFromPool = Math.min(availableFor[_wantedTokenFromPool][_offeredTokenToPool], _maxWantedFromOffered);
    _tookFromSwapper = IYearnOTCSwapper(_swapper).getTotalAmountOut(_wantedTokenFromPool, _offeredTokenToPool, _tookFromPool);
    IERC20(_offeredTokenToPool).safeTransferFrom(_swapper, address(this), _tookFromSwapper);
    _performTradeOnSwapper(_offeredTokenToPool, _wantedTokenFromPool, _tookFromPool, _tookFromSwapper);
    // emit event();
  }

  function _performTradeOnSwapper(
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
