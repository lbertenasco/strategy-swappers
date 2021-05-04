// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../SwapperRegistry.sol';
import '../OTCSwapper.sol';
import './OTCPoolDesk.sol';

interface IOTCPoolTradeable {
  event SwapperRegistrySet(address indexed _swapperRegistry);
  event Claimed(address indexed _receiver, address _claimedToken, uint256 _amountClaimed);
  event TradePerformed(
    address indexed _swapper,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _tookFromPool,
    uint256 _tookFromSwapper
  );

  function swapperRegistry() external view returns (address);

  function swappedAvailable(address _swappedToken) external view returns (uint256 _swappedAmount);

  function setSwapperRegistry(address _swapperRegistry) external;

  function claim(address _token, uint256 _amount) external;

  function takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) external returns (uint256 _tookFromPool, uint256 _tookFromSwapper);
}

abstract contract OTCPoolTradeable is IOTCPoolTradeable, OTCPoolDesk {
  using SafeERC20 for IERC20;

  address public override swapperRegistry;
  mapping(address => uint256) public override swappedAvailable;

  constructor(address _swapperRegistry) {
    swapperRegistry = _swapperRegistry;
  }

  function _setSwapperRegistry(address _swapperRegistry) internal {
    require(_swapperRegistry != address(0), 'OTCPool: zero address');
    swapperRegistry = _swapperRegistry;
    emit SwapperRegistrySet(_swapperRegistry);
  }

  modifier onlyRegisteredSwapper {
    require(SwapperRegistry(swapperRegistry).isSwapper(msg.sender), 'OTCPool: not a registered swapper');
    _;
  }

  function _claim(
    address _receiver,
    address _token,
    uint256 _amountToClaim
  ) internal {
    require(_receiver != address(0), 'OTCPool: receiver should not be zero');
    require(_token != address(0), 'OTCPool: token should not be zero');
    require(_amountToClaim > 0, 'OTCPool: should provide more than zero');
    _reduceSwappedAvailable(_token, _amountToClaim);
    IERC20(_token).safeTransfer(_receiver, _amountToClaim);
    emit Claimed(_receiver, _token, _amountToClaim);
  }

  function _reduceSwappedAvailable(address _token, uint256 _amountToClaim) internal {
    require(_amountToClaim >= swappedAvailable[_token], 'OTCPool: swapped not available');
    swappedAvailable[_token] -= _amountToClaim;
  }

  // TODO: Discuss if this logic should be here, or should we make this calcs inside the OTC swapper
  // and trust that contract (philosophical discussion)
  function _performTradeOnSwapper(
    address _swapper,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) internal returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    if (availableFor[_wantedTokenFromPool][_offeredTokenToPool] == 0) return (0, 0);
    uint256 _maxWantedFromOffered = IOTCSwapper(_swapper).getTotalAmountOut(_offeredTokenToPool, _wantedTokenFromPool, _maxOfferedAmount);
    _tookFromPool = Math.min(availableFor[_wantedTokenFromPool][_offeredTokenToPool], _maxWantedFromOffered);
    _tookFromSwapper = IOTCSwapper(_swapper).getTotalAmountOut(_wantedTokenFromPool, _offeredTokenToPool, _tookFromPool);
    IERC20(_offeredTokenToPool).safeTransferFrom(_swapper, address(this), _tookFromSwapper);
    _performTrade(_offeredTokenToPool, _wantedTokenFromPool, _tookFromPool, _tookFromSwapper);
    emit TradePerformed(_swapper, _offeredTokenToPool, _wantedTokenFromPool, _tookFromPool, _tookFromSwapper);
  }

  function _performTrade(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _takenFromPool,
    uint256 _providedFromSwapper
  ) internal {
    require(_takenFromPool <= availableFor[_wantedTokenFromPool][_offeredTokenToPool], 'OTCPool: amount not available');
    availableFor[_wantedTokenFromPool][_offeredTokenToPool] -= _takenFromPool;
    swappedAvailable[_offeredTokenToPool] += _providedFromSwapper;
  }
}