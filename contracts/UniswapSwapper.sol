// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import './StrategySwapper.sol';

interface IUniswapSwapper is IStrategySwapper {}

contract UniswapSwapper is IUniswapSwapper, StrategySwapper {
  address uniswap;

  constructor(address _uniswap) {
    _uniswap = uniswap;
  }

  function _createSwap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amount,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal override returns (uint256 _id) {
    _id = super._createSwap(_tokenIn, _tokenOut, _amount, _maxSlippage, _deadline);
    super._executeAndSaveSwap(_id);
  }

  function _executeSwap(uint256 _id) internal override returns (uint256 _totalReceived) {
    address[] memory _path = new address[](2);
    _path[0] = address(0); // from
    _path[1] = address(0); // to

    // Approve given erc20
    IERC20(_path[0]).safeApprove(uniswap, 0);
    IERC20(_path[0]).safeApprove(
      uniswap,
      /* _amount */
      0
    );
    // Swap it
    IUniswapV2Router02(uniswap).swapExactTokensForTokens(
      _amount,
      0, // min amount (slippage calculation)
      _path,
      address(this),
      now.add(1800)
    );
  }
}
