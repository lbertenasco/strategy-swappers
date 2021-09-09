import { ethers } from 'hardhat';

async function main() {
  const strategy = '';
  const asyncSwapper = '';
  const tradeFactory = await ethers.getContract('TradeFactory');
  await tradeFactory.setStrategyAsyncSwapper(strategy, asyncSwapper);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
