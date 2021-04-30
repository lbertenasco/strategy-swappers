// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './Machinery.sol';

interface IStrategySwapper {
  event SwapCreated(Swap _swapInformation);

  function WETH() external view returns (address);

  function SLIPPAGE_PRECISION() external view returns (uint256);

  // function pendingSwaps(uint256 _index) external returns (Swap memory);

  // function swapById(uint256 _id) external view returns (Swap memory);

  function swap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external payable;

  function executeSwap(uint256 _id) external returns (uint256 _receivedAmount);

  function expireSwap(uint256 _id) external returns (uint256 _returnedAmount);

  struct Swap {
    uint256 id;
    address from;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 maxSlippage;
    uint256 deadline;
  }
}

abstract contract StrategySwapper is IStrategySwapper, Machinery {
  using SafeERC20 for IERC20;

  address public constant ETH = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
  address public immutable override WETH;
  uint256 public immutable override SLIPPAGE_PRECISION;

  Swap[] public pendingSwaps;
  mapping(uint256 => uint256) public pendingSwapIndex;
  mapping(uint256 => Swap) public swapById;
  uint256 internal _swapsCounter = 0;

  constructor(
    address _mechanicsRegistry,
    address _weth,
    uint256 _slippagePrecision
  ) Machinery(_mechanicsRegistry) {
    SLIPPAGE_PRECISION = _slippagePrecision;
    WETH = _weth;
  }

  function setMechanicsRegistry(address _mechanicsRegistry) external override {
    // TODO: only governance
    _setMechanicsRegistry(_mechanicsRegistry);
  }

  modifier isPendingSwap(uint256 _id) {
    require(swapById[_id].id == _id, 'StrategySwapper: non existant swap');
    _;
  }

  function swap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external payable virtual override {
    require(_tokenIn != address(0) && _tokenOut != address(0), 'StrategySwapper: zero address');
    require(_amountIn > 0, 'StrategySwapper: zero amount');
    require(_maxSlippage > 0, 'StrategySwapper: zero slippage');
    require(_deadline > block.timestamp, 'StrategySwapper: deadline too soon');
    require(_tokenIn != ETH || _amountIn == msg.value, 'StrategySwapper: missing eth');
    // only strategy
    _swap(msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  function _swap(
    address _from,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal virtual {
    if (_tokenIn != ETH) {
      IERC20(_tokenIn).safeTransferFrom(_from, address(this), _amountIn);
    }
    uint256 _id = _swapsCounter;
    Swap memory _swapInformation = Swap(_id, _from, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
    pendingSwapIndex[_id] = pendingSwaps.length;
    pendingSwaps.push(_swapInformation);
    swapById[_id] = _swapInformation;
    _swapsCounter++;
    emit SwapCreated(_swapInformation);
  }

  function expireSwap(uint256 _id) external virtual override isPendingSwap(_id) returns (uint256 _returnedAmount) {
    Swap storage _swapInformation = swapById[_id];
    require(_swapInformation.deadline <= block.timestamp, 'StrategySwapper: swap not expired');
    if (_swapInformation.tokenIn == ETH) {
      payable(_swapInformation.from).transfer(_swapInformation.amountIn);
    } else {
      IERC20(_swapInformation.tokenIn).safeTransfer(_swapInformation.from, _swapInformation.amountIn);
    }
    _returnedAmount = _swapInformation.amountIn;
    _deletePendingSwap(_swapInformation);
  }

  function _checkPreExecuteSwap(uint256 _id) internal view returns (Swap storage _swapInformation) {
    _swapInformation = swapById[_id];
    require(_swapInformation.deadline >= block.timestamp, 'StrategySwapper: swap has expired');
  }

  function _deletePendingSwap(Swap storage _swapInformation) internal {
    // Delete from pending swaps, reuse space.
    delete pendingSwapIndex[_swapInformation.id];
    delete swapById[_swapInformation.id];
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal virtual returns (uint256 _receivedAmount);

  function executeSwap(uint256 _id) external override onlyMechanic isPendingSwap(_id) returns (uint256 _receivedAmount) {
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);

    _receivedAmount = _executeSwap(
      _swapInformation.from,
      _swapInformation.tokenIn,
      _swapInformation.tokenOut,
      _swapInformation.amountIn,
      _swapInformation.maxSlippage
    );

    _deletePendingSwap(_swapInformation);
  }
}
