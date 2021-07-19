import { run, ethers } from 'hardhat';

async function main() {
  run('compile');
  const tradeFactory = await ethers.getContract('TradeFactory');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
