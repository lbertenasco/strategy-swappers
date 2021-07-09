// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import 'hardhat/console.sol';
import '../SwapperRegistry.sol';

interface ITradeFactoryPositionsHandler {
  struct Trade {
    uint256 _id;
    address _strategy;
    address _swapper;
    address _tokenIn;
    address _tokenOut;
    uint256 _amountIn;
    uint256 _maxSlippage;
    uint256 _deadline;
  }

  event TradeCreated(
    uint256 indexed _id,
    address _strategy,
    address _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  );

  event TradeCanceled(address indexed _strategy, uint256 indexed _id);

  event TradesCanceled(address indexed _strategy, uint256[] _ids);

  event TradesSwapperChanged(address indexed _strategy, uint256[] _ids, string _newSwapper);

  function pendingTradesById(uint256)
    external
    view
    returns (
      uint256 _id,
      address _strategy,
      address _swapper,
      address _tokenIn,
      address _tokenOut,
      uint256 _amountIn,
      uint256 _maxSlippage,
      uint256 _deadline
    );

  function pendingTradesIds() external view returns (uint256[] memory _pendingIds);

  function pendingTradesIds(address _strategy) external view returns (uint256[] memory _pendingIds);

  function swapperSafetyCheckpoint(address) external view returns (uint256);

  function SWAPPER_REGISTRY() external view returns (address);

  function setSwapperSafetyCheckpoint(uint256 _checkpoint) external;

  function create(
    string memory _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256 _id);

  function cancelPending(uint256 _id) external;

  function cancelAllPending() external returns (uint256[] memory _canceledTradesIds);

  function changePendingTradesSwapper(string memory _swapper) external returns (uint256[] memory _changedSwapperIds);
}

abstract contract TradeFactoryPositionsHandler is ITradeFactoryPositionsHandler {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;

  uint256 private _tradeCounter = 1;

  mapping(uint256 => Trade) public override pendingTradesById;

  mapping(address => uint256) public override swapperSafetyCheckpoint;

  EnumerableSet.UintSet internal _pendingTradesIds;

  mapping(address => EnumerableSet.UintSet) internal _pendingTradesByOwner;

  address public immutable override SWAPPER_REGISTRY;

  constructor(address _swapperRegistry) {
    SWAPPER_REGISTRY = _swapperRegistry;
  }

  modifier onlyStrategy {
    require(msg.sender == msg.sender, 'TradeFactory: not a strategy'); // TODO:
    _;
  }

  function pendingTradesIds() external view override returns (uint256[] memory _pendingIds) {
    _pendingIds = new uint256[](_pendingTradesIds.length());
    for (uint256 i; i < _pendingTradesIds.length(); i++) {
      _pendingIds[i] = _pendingTradesIds.at(i);
    }
  }

  function pendingTradesIds(address _strategy) external view override returns (uint256[] memory _pendingIds) {
    _pendingIds = new uint256[](_pendingTradesByOwner[_strategy].length());
    for (uint256 i; i < _pendingTradesByOwner[_strategy].length(); i++) {
      _pendingIds[i] = _pendingTradesByOwner[_strategy].at(i);
    }
  }

  function create(
    string memory _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override onlyStrategy returns (uint256 _id) {
    _id = _create(_swapper, msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  function cancelPending(uint256 _id) external override onlyStrategy {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    require(pendingTradesById[_id]._strategy == msg.sender, 'TradeFactory: does not own trade');
    Trade memory _trade = pendingTradesById[_id];
    _removePendingTrade(_trade._strategy, _id);
    emit TradeCanceled(msg.sender, _id);
  }

  function cancelAllPending() external override onlyStrategy returns (uint256[] memory _canceledTradesIds) {
    require(_pendingTradesByOwner[msg.sender].length() > 0, 'TradeFactory: no trades pending from strategy');
    _canceledTradesIds = new uint256[](_pendingTradesByOwner[msg.sender].length());
    for (uint256 i; i < _pendingTradesByOwner[msg.sender].length(); i++) {
      _canceledTradesIds[i] = _pendingTradesByOwner[msg.sender].at(i);
    }
    for (uint256 i; i < _canceledTradesIds.length; i++) {
      _removePendingTrade(msg.sender, _canceledTradesIds[i]);
    }
    emit TradesCanceled(msg.sender, _canceledTradesIds);
  }

  function changePendingTradesSwapper(string memory _swapper) external override onlyStrategy returns (uint256[] memory _changedSwapperIds) {
    (bool _existsSwapper, address _swapperAddress, uint256 _swapperInitialization) = SwapperRegistry(SWAPPER_REGISTRY).isSwapper(_swapper);
    require(_existsSwapper, 'TradeFactory: invalid swapper');
    require(_swapperInitialization <= swapperSafetyCheckpoint[msg.sender], 'TradeFactory: initialization greater than checkpoint');
    _changedSwapperIds = new uint256[](_pendingTradesByOwner[msg.sender].length());
    for (uint256 i; i < _pendingTradesByOwner[msg.sender].length(); i++) {
      pendingTradesById[_pendingTradesByOwner[msg.sender].at(i)]._swapper = _swapperAddress;
      _changedSwapperIds[i] = _pendingTradesByOwner[msg.sender].at(i);
    }
    emit TradesSwapperChanged(msg.sender, _changedSwapperIds, _swapper);
  }

  function setSwapperSafetyCheckpoint(uint256 _checkpoint) external override onlyStrategy {
    require(_checkpoint <= block.timestamp, 'TradeFactory: invalid checkpoint');
    swapperSafetyCheckpoint[msg.sender] = _checkpoint;
  }

  function _create(
    string memory _swapper,
    address _strategy,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal returns (uint256 _id) {
    (bool _existsSwapper, address _swapperAddress, uint256 _swapperInitialization) = SwapperRegistry(SWAPPER_REGISTRY).isSwapper(_swapper);
    require(_existsSwapper, 'TradeFactory: invalid swapper');
    require(_swapperInitialization <= swapperSafetyCheckpoint[_strategy], 'TradeFactory: initialization greater than checkpoint');
    require(_tokenIn != address(0) && _tokenOut != address(0), 'TradeFactory: zero address');
    require(_amountIn > 0, 'TradeFactory: zero amount');
    require(_maxSlippage > 0, 'TradeFactory: zero slippage');
    require(block.timestamp < _deadline, 'TradeFactory: deadline too soon');
    _id = _tradeCounter;
    Trade memory _trade = Trade(_tradeCounter, _strategy, _swapperAddress, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
    pendingTradesById[_trade._id] = _trade;
    _pendingTradesByOwner[_strategy].add(_trade._id);
    _pendingTradesIds.add(_trade._id);
    _tradeCounter += 1;
    emit TradeCreated(
      _trade._id,
      _trade._strategy,
      _trade._swapper,
      _trade._tokenIn,
      _trade._tokenOut,
      _trade._amountIn,
      _trade._maxSlippage,
      _trade._deadline
    );
  }

  function _removePendingTrade(address _strategy, uint256 _id) internal {
    _pendingTradesByOwner[_strategy].remove(_id);
    _pendingTradesIds.remove(_id);
    delete pendingTradesById[_id];
  }
}
