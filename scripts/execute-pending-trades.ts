import { run, ethers, getChainId } from 'hardhat';
import zrx from './libraries/zrx';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import oneinch from './libraries/oneinch';
import wallet from '../test/utils/wallet';

async function main() {
  const chainId = await getChainId();
  console.log('Chain ID:', chainId);
  const tradeFactory = await ethers.getContract('TradeFactory');
  const ZRXSwapper = await ethers.getContract('ZRXSwapper');
  const oneInchAggregatorSwapper = await ethers.getContract('OneInchAggregatorSwapper');
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: any = [];
  for (const id of pendingTradesIds) {
    pendingTrades.push(await tradeFactory['pendingTradesById(uint256)'](id));
  }
  for (const pendingTrade of pendingTrades) {
    console.log('Executing through 0x the following pending trade:', pendingTrade._id.toString());
    let data;
    if (compareAddresses(pendingTrade._swapper, ZRXSwapper.address)) {
      console.log('Executing through ZRX');
      const zrxAPIResponse = await zrx.quote({
        chainId: Number(chainId),
        sellToken: pendingTrade._tokenIn,
        buyToken: pendingTrade._tokenOut,
        sellAmount: pendingTrade._amountIn,
        sippagePercentage: 0.05,
      });
      data = zrxAPIResponse.data;
    } else if (compareAddresses(pendingTrade._swapper, oneInchAggregatorSwapper.address)) {
      console.log('Executing through ONE INCH');
      const oneInchApiResponse = await oneinch.swap(Number(chainId), {
        tokenIn: pendingTrade._tokenIn,
        tokenOut: pendingTrade._tokenOut,
        amountIn: pendingTrade._amountIn,
        fromAddress: wallet.generateRandomAddress(),
        receiver: pendingTrade._strategy,
        slippage: 3,
        allowPartialFill: false,
        disableEstimate: true,
        fee: 0,
        gasLimit: 5_000_000,
      });
      data = oneInchApiResponse.tx.data;
    }
    await tradeFactory['execute(uint256,bytes)'](pendingTrade._id, data, { gasPrice: 5_000_000 });
  }
}

const compareAddresses = (str1: string, str2: string): boolean => str1.toLowerCase() === str2.toLowerCase();

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
