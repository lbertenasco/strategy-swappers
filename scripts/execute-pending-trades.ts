import { run, ethers, getChainId } from 'hardhat';
import zrx from './libraries/zrx';
import { TransactionResponse } from '@ethersproject/abstract-provider';

async function main() {
  const chainId = await getChainId();
  console.log('Chain ID:', chainId);
  const tradeFactory = await ethers.getContract('TradeFactory');
  const pendingTrades = await tradeFactory['pendingTradesIds()']();
  for (let i = 0; i < pendingTrades.length; i++) {
    const pendingTrade = await tradeFactory.pendingTradesById(pendingTrades[i]);
    console.log('Swapper', pendingTrade._swapper);
    console.log('Token in', pendingTrade._tokenIn);
    console.log('Token out', pendingTrade._tokenOut);
    console.log('Amount in', pendingTrade._amountIn);
    console.log('Max slippage', pendingTrade._maxSlippage);
    const apiResponse = await zrx.quote({
      chainId: Number(chainId),
      sellToken: pendingTrade._tokenIn,
      buyToken: pendingTrade._tokenOut,
      sellAmount: pendingTrade._amountIn,
      sippagePercentage: 0.005,
      skipValidation: true,
    });
    const executedTrade: TransactionResponse = await tradeFactory['execute(uint256,bytes)'](pendingTrades[i], apiResponse.data, {
      gasLimit: 5000000,
    });
    console.log('Executed trade with hash:', executedTrade.hash);
    console.log('------------------------');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
