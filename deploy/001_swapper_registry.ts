import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  await hre.deployments.deploy('SwapperRegistry', {
    contract: 'contracts/SwapperRegistry.sol:SwapperRegistry',
    from: deployer,
    args: [governor],
    log: true,
  });
};
export default deployFunction;
deployFunction.tags = ['SwapperRegistry'];
