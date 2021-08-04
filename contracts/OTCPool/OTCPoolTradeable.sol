// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../TradeFactory/TradeFactorySwapperHandler.sol';
import '../OTCSwapper.sol';
import './OTCPoolDesk.sol';

interface IOTCPoolTradeable {
  event TradeFactorySet(address indexed _tradeFactory);
  event Claimed(address indexed _receiver, address _claimedToken, uint256 _amountClaimed);
  event TradePerformed(
    address indexed _swapper,
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _tookFromPool,
    uint256 _tookFromSwapper
  );

  function tradeFactory() external view returns (address _tradeFactory);

  function swappedAvailable(address _swappedToken) external view returns (uint256 _swappedAmount);

  function setTradeFactory(address _tradeFactory) external;

  function claim(address _token, uint256 _amount) external;

  function takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _offeredAmount
  ) external returns (uint256 _tookFromPool, uint256 _tookFromSwapper);
}

abstract contract OTCPoolTradeable is IOTCPoolTradeable, OTCPoolDesk {
  using SafeERC20 for IERC20;

  address public override tradeFactory;
  mapping(address => uint256) public override swappedAvailable;

  constructor(address _tradeFactory) {
    _setTradeFactory(_tradeFactory);
  }

  // this modifier allows any registered swapper to utilize OTC funds, this is not an idial design. TODO change.
  modifier onlyRegisteredSwapper() {
    require(ITradeFactorySwapperHandler(tradeFactory).isSwapper(msg.sender), 'OTCPool: unregistered swapper');
    _;
  }

  function setTradeFactory(address _tradeFactory) external override onlyGovernor {
    _setTradeFactory(_tradeFactory);
  }

  function _setTradeFactory(address _tradeFactory) internal {
    require(_tradeFactory != address(0), 'OTCPool: zero address');
    tradeFactory = _tradeFactory;
    emit TradeFactorySet(_tradeFactory);
  }

  function claim(address _token, uint256 _amountToClaim) external override onlyOTCProvider {
    require(msg.sender != address(0), 'OTCPool: zero address');
    require(_token != address(0), 'OTCPool: zero address'); // TODO: can this be deprecated ? technically if token is zero, it wont have swapped available -- gas optimization
    require(_amountToClaim <= swappedAvailable[_token], 'OTCPool: zero claim');
    swappedAvailable[_token] -= _amountToClaim;
    IERC20(_token).safeTransfer(msg.sender, _amountToClaim);
    _subTokenUnderManagement(_token, _amountToClaim);
    emit Claimed(msg.sender, _token, _amountToClaim);
  }

  function takeOffer(
    address _offeredTokenToPool,
    address _wantedTokenFromPool,
    uint256 _maxOfferedAmount
  ) external override onlyRegisteredSwapper returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    if (availableFor[_wantedTokenFromPool][_offeredTokenToPool] == 0) return (0, 0);
    (_tookFromPool, _tookFromSwapper) = _getMaxTakeableFromPoolAndSwapper(
      msg.sender,
      _offeredTokenToPool,
      _wantedTokenFromPool,
      _maxOfferedAmount
    );
    IERC20(_offeredTokenToPool).safeTransferFrom(msg.sender, address(this), _tookFromSwapper);
    _addTokenUnderManagement(_offeredTokenToPool, _tookFromSwapper);
    availableFor[_wantedTokenFromPool][_offeredTokenToPool] -= _tookFromPool;
    swappedAvailable[_offeredTokenToPool] += _tookFromSwapper;
    IERC20(_wantedTokenFromPool).safeTransfer(msg.sender, _tookFromPool);
    _subTokenUnderManagement(_wantedTokenFromPool, _tookFromPool);
    emit TradePerformed(msg.sender, _offeredTokenToPool, _wantedTokenFromPool, _tookFromPool, _tookFromSwapper);
  }

  function _getMaxTakeableFromPoolAndSwapper(
    address _swapper,
    address _offered,
    address _wanted,
    uint256 _offeredAmount
  ) internal view virtual returns (uint256 _tookFromPool, uint256 _tookFromSwapper) {
    uint256 _maxWantedFromOffered = IOTCSwapper(_swapper).getTotalAmountOut(_offered, _wanted, _offeredAmount);
    _tookFromPool = Math.min(availableFor[_wanted][_offered], _maxWantedFromOffered);
    _tookFromSwapper = IOTCSwapper(_swapper).getTotalAmountOut(_wanted, _offered, _tookFromPool);
  }
}
