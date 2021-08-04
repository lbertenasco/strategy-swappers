import { run, ethers } from 'hardhat';

async function main() {
  const tradeFactory = await ethers.getContract('TradeFactory');
  const pendingTrades = await tradeFactory['pendingTradesIds()']();
  for (let i = 0; i < pendingTrades.length; i++) {
    console.log('Executing trade', pendingTrades[i].toString());
    await tradeFactory.execute(pendingTrades[i], { gasLimit: 1000000 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
