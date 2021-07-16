import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const OTC_PROVIDER = '0xfeb4acf3df3cdea7399794d0869ef76a6efaff52'; // ychad.eth
  const swapperRegistry = await hre.deployments.get('SwapperRegistry');

  await hre.deployments.deploy('TradeFactory', {
    contract: 'contracts/OTCPool/OTCPool.sol:OTCPool',
    from: deployer,
    args: [governor, OTC_PROVIDER, swapperRegistry.address],
    log: true,
  });
};
export default deployFunction;
deployFunction.dependencies = ['SwapperRegistry'];
deployFunction.tags = ['OTCPool'];
