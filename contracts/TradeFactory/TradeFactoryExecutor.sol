// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '../Swapper.sol';
import '../utils/Machinery.sol';

import './TradeFactoryPositionsHandler.sol';

interface ITradeFactoryExecutor {
  event TradeExpired(uint256 indexed _id);

  event TradeExecuted(uint256 indexed _id, uint256 _receivedAmount);

  event SwapperAndTokenEnabled(address indexed _swapper, address _token);

  function approvedTokensBySwappers(address _swapper) external view returns (address[] memory _tokens);

  function execute(uint256 _id) external returns (uint256 _receivedAmount);

  function expire(uint256 _id) external returns (uint256 _freedAmount);
}

abstract contract TradeFactoryExecutor is ITradeFactoryExecutor, TradeFactoryPositionsHandler, Machinery {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(address _mechanicsRegistry) Machinery(_mechanicsRegistry) {}

  mapping(address => EnumerableSet.AddressSet) internal _approvedTokensBySwappers;

  function approvedTokensBySwappers(address _swapper) external view override returns (address[] memory _tokens) {
    _tokens = new address[](_approvedTokensBySwappers[_swapper].length());
    for (uint256 i = 0; i < _approvedTokensBySwappers[_swapper].length(); i++) {
      _tokens[i] = _approvedTokensBySwappers[_swapper].at(i);
    }
  }

  // TradeFactoryExecutor

  function execute(uint256 _id) external override onlyMechanic returns (uint256 _receivedAmount) {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradesById[_id];
    require(block.timestamp <= _trade._deadline, 'TradeFactory: trade has expired');
    require(!ISwapperRegistry(SWAPPER_REGISTRY).deprecatedByAddress(_trade._swapper), 'TradeFactory: deprecated swapper');
    if (!_approvedTokensBySwappers[_trade._swapper].contains(_trade._tokenIn)) {
      _enableSwapperToken(_trade._swapper, _trade._tokenIn);
    }
    IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, address(this), _trade._amountIn);
    _receivedAmount = ISwapper(_trade._swapper).swap(_trade._strategy, _trade._tokenIn, _trade._tokenOut, _trade._amountIn, _trade._maxSlippage);
    _removePendingTrade(_trade._strategy, _id);
    emit TradeExecuted(_id, _receivedAmount);
  }

  function expire(uint256 _id) external override onlyMechanic returns (uint256 _freedAmount) {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradesById[_id];
    require(_trade._deadline <= block.timestamp, 'TradeFactory: trade not expired');
    _freedAmount = _trade._amountIn;
    // We have to take tokens from strategy, to decrease the allowance
    IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, address(this), _trade._amountIn);
    // Send tokens back to strategy
    IERC20(_trade._tokenIn).safeTransfer(_trade._strategy, _trade._amountIn);
    // Remove trade
    _removePendingTrade(_trade._strategy, _id);
    emit TradeExpired(_id);
  }

  function _enableSwapperToken(address _swapper, address _token) internal {
    IERC20(_token).safeApprove(_swapper, type(uint256).max);
    _approvedTokensBySwappers[_swapper].add(_token);
    emit SwapperAndTokenEnabled(_swapper, _token);
  }
}
