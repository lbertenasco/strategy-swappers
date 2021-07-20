import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '../../utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');
  const ONE_INCH = '0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E';
  const PARTS = 3;
  const FLAGS = 0;

  const deploy = await hre.deployments.deploy('OneInchSwapper', {
    contract: 'contracts/swappers/OneInchSwapper.sol:OneInchSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, ONE_INCH, PARTS, FLAGS],
    log: true,
  });

  await hre.deployments.execute('SwapperRegistry', { from: governor, gasLimit: 200000 }, 'addSwapper', 'one-inch', deploy.address);

  if (await shouldVerifyContract(hre, 'OneInchSwapper')) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address, ONE_INCH, PARTS, FLAGS],
    });
  }
};
deployFunction.dependencies = ['SwapperRegistry', 'TradeFactory'];
deployFunction.tags = ['OneInchSwapper', 'Mainnet'];
export default deployFunction;
