import { run, ethers } from 'hardhat';
import zrx from './libraries/zrx';
const CHAIN_ID = 137;
const zrxSwapper = '0xcce31974C651BFd6565262382776828d2Faaf998';

async function main() {
  const tradeFactory = await ethers.getContract('TradeFactory');
  const pendingTradesIds = await tradeFactory['pendingTradesIds()']();
  const pendingTrades: any = [];
  for (const id of pendingTradesIds) {
    console.log('get data for trade', id.toString());
    pendingTrades.push(await tradeFactory['pendingTradesById(uint256)'](id));
  }

  for (const pendingTrade of pendingTrades) {
    if (pendingTrade._swapper != zrxSwapper) continue;
    console.log('executing though 0x the following pending trade:');
    printPendingTrade(pendingTrade);
    const zrxData = await zrxQuotePendingTrade(pendingTrade);
    await tradeFactory['execute(uint256,bytes)'](pendingTrade._id, zrxData.data, {
      gasPrice: 0,
    });
  }
}

function printPendingTrade(pendingTrade: any) {
  console.log({
    _id: pendingTrade._id.toString(),
    _strategy: pendingTrade._strategy,
    _swapper: pendingTrade._swapper,
    _tokenIn: pendingTrade._tokenIn,
    _tokenOut: pendingTrade._tokenOut,
    _amountIn: pendingTrade._amountIn.toString(),
    _maxSlippage: pendingTrade._maxSlippage.toNumber(),
    _deadline: pendingTrade._deadline.toString(),
  });
}

async function zrxQuotePendingTrade(pendingTrade: any) {
  return await zrx.quote({
    chainId: CHAIN_ID,
    sellToken: pendingTrade._tokenIn,
    buyToken: pendingTrade._tokenOut,
    sellAmount: pendingTrade._amountIn,
    sippagePercentage: pendingTrade._maxSlippage / 100_000,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
