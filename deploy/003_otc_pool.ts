import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getRealChainIdOfFork } from '../utils/network';

const OTC_PROVIDER: { [chainId: string]: string } = {
  // Fork
  '31337': '0xfeb4acf3df3cdea7399794d0869ef76a6efaff52', // ychad.eth
  // Mainnet
  '1': '0xfeb4acf3df3cdea7399794d0869ef76a6efaff52', // ychad.eth
  // Polygon
  '137': '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', // yMech alejo
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor, yMech } = await hre.getNamedAccounts();

  const swapperRegistry = await hre.deployments.get('SwapperRegistry');

  const chainId = getRealChainIdOfFork(hre) || (await hre.getChainId());

  const deploy = await hre.deployments.deploy('OTCPool', {
    contract: 'contracts/OTCPool/OTCPool.sol:OTCPool',
    from: deployer,
    args: [governor, OTC_PROVIDER[chainId], swapperRegistry.address],
    log: true,
  });

  if (!process.env.TEST && !process.env.FORK) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, OTC_PROVIDER[chainId], swapperRegistry.address],
    });
  }
};
deployFunction.dependencies = ['SwapperRegistry'];
deployFunction.tags = ['OTCPool'];
export default deployFunction;
