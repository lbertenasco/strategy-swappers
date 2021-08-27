// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

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

  event TradesCanceled(address indexed _strategy, uint256[] _ids);

  event TradesSwapperChanged(uint256[] _ids, address _newSwapper);

  event TradesMerged(uint256 indexed _anchorTrade, uint256[] _ids);

  error InvalidTrade();

  error InvalidDeadline();

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

  function create(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256 _id);

  function cancelPendingTrades(uint256[] calldata _ids) external;

  function changePendingTradesSwapper(uint256[] calldata _ids, address _swapper) external;

  function mergePendingTrades(uint256 _anchorTradeId, uint256[] calldata _toMergeIds) external;
}
