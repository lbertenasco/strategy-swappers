// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IStrategySwapper {
  struct Swap {
    uint256 _id;
    address _strategy;
    address _tokenIn;
    address _tokenOut;
    uint256 _amount;
    uint256 _maxSlippage;
    uint256 _deadline;
  }

  function createSwap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amount,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256 _id);

  function createSwapAndWithdrawDebt(
    address _tokenIn,
    address _tokenOut,
    uint256 _amount,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256, uint256);

  function withdrawAllDebt() external;

  function withdrawDebt(address _token) external returns (uint256);
}

abstract contract StrategySwapper is IStrategySwapper {
  mapping(address => Swap[]) strategiesSwaps; // Strategy => Swaps[]
  mapping(uint256 => Swap) swaps; // SwapId => Strategy
  mapping(address => mapping(address => uint256)) tokenDebt; // Strategy => ERC20 => Debt
  uint256 strategiesCounter = 0;

  constructor() {}

  function createSwap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amount,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override returns (uint256 _id) {
    _id = _createSwap(_tokenIn, _tokenOut, _amount, _maxSlippage, _deadline);
  }

  function _createSwap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amount,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal virtual returns (uint256 _id) {
    // requires
    // take tokens from strategy
    _id = strategiesCounter;
    Swap memory _swap = Swap(_id, msg.sender, _tokenIn, _tokenOut, _amount, _maxSlippage, _deadline);
    strategiesSwaps[msg.sender].push(_swap);
    swaps[_id] = _swap;
    strategiesCounter++;
  }

  function createSwapAndWithdrawDebt(
    address _tokenIn,
    address _tokenOut,
    uint256 _amount,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override returns (uint256 _id, uint256 _totalTokenDebt) {
    _id = _createSwap(_tokenIn, _tokenOut, _amount, _maxSlippage, _deadline);
    _totalTokenDebt = _withdrawDebt(_tokenOut);
  }

  function withdrawDebt(address _token) external override returns (uint256) {
    // send all token debt
    // set debt to 0
  }

  function _withdrawDebt(address _token) internal returns (uint256) {}

  function withdrawAllDebt() external override {}

  function _executeAndSaveSwap(uint256 _id) internal returns (uint256 _receivedFromSwap) {
    // requires
    Swap memory _swap = swaps[_id];
    _receivedFromSwap = _executeSwap(_id);
    tokenDebt[_swap._tokenOut][_swap._strategy] = tokenDebt[_swap._tokenOut][_swap._strategy] + _receivedFromSwap;
  }

  function _executeSwap(uint256 _id) internal virtual returns (uint256) {}
}
