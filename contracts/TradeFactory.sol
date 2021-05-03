// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './SwapperRegistry.sol';
import './Swapper.sol';

interface ITradeFactory {
  struct Trade {
    uint256 _id;
    address _owner;
    address _swapper;
    address _tokenIn;
    address _tokenOut;
    uint256 _amountIn;
    uint256 _maxSlippage;
    uint256 _deadline;
  }
}

abstract contract TradeFactory is ITradeFactory {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  uint256 _tradeCounter = 0;

  mapping(uint256 => Trade) pendingTradeById;

  EnumerableSet.UintSet internal _pendingTradesIds;

  mapping(address => EnumerableSet.UintSet) pendingTradesByOwner;

  mapping(address => EnumerableSet.AddressSet) internal _approvedTokensBySwappers;

  address swapperRegistry;

  function _create(
    string memory _swapper,
    address _owner,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal virtual returns (uint256 _id) {
    (bool _existsSwapper, address _swapperAddress) = SwapperRegistry(swapperRegistry).isSwapper(_swapper);
    require(!_existsSwapper, 'TradeFactory: invalid swapper');
    require(_tokenIn != address(0) && _tokenOut != address(0), 'TradeFactory: zero address');
    require(_amountIn > 0, 'TradeFactory: zero amount');
    require(_maxSlippage > 0, 'TradeFactory: zero slippage');
    require(_deadline > block.timestamp, 'TradeFactory: deadline too soon');
    _id = _tradeCounter;
    Trade memory _trade = Trade(_tradeCounter, _owner, _swapperAddress, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
    pendingTradeById[_trade._id] = _trade;
    pendingTradesByOwner[_owner].add(_trade._id);
    _pendingTradesIds.add(_trade._id);
    // emit event
  }

  // only owner of trade
  function _cancelPending(uint256 _id) internal virtual {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradeById[_id];
    pendingTradesByOwner[_trade._owner].remove(_id);
    _pendingTradesIds.remove(_id);
    delete pendingTradeById[_id];
    // emit event
  }

  function _cancelAllPendingOfOwner(address _owner) internal virtual {
    require(pendingTradesByOwner[_owner].length() > 0, 'TradeFactory: no trades pending from user');
    uint256[] memory _pendingOwnerIds = new uint256[](pendingTradesByOwner[_owner].length());
    for (uint256 i = 0; i < pendingTradesByOwner[_owner].length(); i++) {
      _pendingOwnerIds[i] = pendingTradesByOwner[_owner].at(i);
    }
    for (uint256 i = 0; i < _pendingOwnerIds.length; i++) {
      pendingTradesByOwner[_owner].remove(_pendingOwnerIds[i]);
      _pendingTradesIds.remove(_pendingOwnerIds[i]);
      delete pendingTradeById[_pendingOwnerIds[i]];
    }
    // emit event
  }

  function _changePendingSwapsSwapperOfOwner(address _owner, string memory _swapper) internal virtual {
    (bool _existsSwapper, address _swapperAddress) = SwapperRegistry(swapperRegistry).isSwapper(_swapper);
    require(!_existsSwapper, 'TradeFactory: invalid swapper');
    for (uint256 i = 0; i < pendingTradesByOwner[_owner].length(); i++) {
      pendingTradeById[pendingTradesByOwner[_owner].at(i)]._swapper = _swapperAddress;
    }
    // emit event
  }

  // only mechanics
  function _execute(uint256 _id) internal virtual returns (uint256 _receivedAmount) {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradeById[_id];
    if (!_approvedTokensBySwappers[_trade._swapper].contains(_trade._tokenIn)) {
      _enableSwapperToken(_trade._swapper, _trade._tokenIn);
    }
    ISwapper(_trade._swapper).executeSwap(_id);
    // emit event
  }

  function _enableSwapperToken(address _swapper, address _token) internal {
    IERC20(_token).safeApprove(_swapper, type(uint256).max);
    _approvedTokensBySwappers[_swapper].add(_token);
    // emit SwapperAndTokenEnabled(_swapper, _token);
  }
}
