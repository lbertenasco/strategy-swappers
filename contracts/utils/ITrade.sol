// SPDX-License-Identifier: MIT
interface ITrade {
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
}
