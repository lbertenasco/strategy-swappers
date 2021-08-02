// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './TradeFactorySwapperHandler.sol';

interface ITradeFactoryFeesHandler {
  event SwapperFeeSet(address _strategy, uint256 _fee);

  function feeReceiver() external view returns (address _maxFee);

  function maxFee() external view returns (uint256 _maxFee);

  function swapperFee(address _swapper) external view returns (uint256 _fee);

  function setFeeReceiver(address _feeReceiver) external;

  function setMaxFee(uint256 _maxFee) external;

  function setSwapperFee(address _swapper, uint256 _fee) external;
}

abstract contract TradeFactoryFeesHandler is ITradeFactoryFeesHandler, TradeFactorySwapperHandler {
  using SafeERC20 for IERC20;

  bytes32 public constant FEE_SETTER = keccak256('FEE_SETTER');

  uint256 public constant PRECISION = 1_000_000; // min is 0.000001

  address public override feeReceiver;

  uint256 public override maxFee;

  mapping(address => uint256) public override swapperFee;

  constructor(address _governor) TradeFactorySwapperHandler(_governor) {
    _setRoleAdmin(FEE_SETTER, MASTER_ADMIN);
    _setupRole(FEE_SETTER, governor);
  }

  function setFeeReceiver(address _feeReceiver) external override onlyRole(FEE_SETTER) {
    require(_feeReceiver != address(0), 'TradeFactory: ');
    feeReceiver = _feeReceiver;
  }

  function setMaxFee(uint256 _maxFee) external override onlyRole(FEE_SETTER) {
    require(_maxFee <= PRECISION, 'TradeFactory: max fee overlow');
    maxFee = _maxFee;
  }

  function setSwapperFee(address _swapper, uint256 _fee) external override onlyRole(FEE_SETTER) {
    require(_fee <= maxFee, 'TradeFactory: fee exceeds max');
    swapperFee[_swapper] = _fee;
    emit SwapperFeeSet(_swapper, _fee);
  }

  function _processFees(
    address _swapper,
    address _tokenIn,
    uint256 _amountIn
  ) internal returns (uint256 _feeAmount) {
    _feeAmount = (_amountIn * swapperFee[_swapper]) / (PRECISION * 100);
    if (_feeAmount > 0) IERC20(_tokenIn).safeTransfer(feeReceiver, _feeAmount);
  }
}
