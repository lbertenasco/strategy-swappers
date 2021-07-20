import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContracts } from '../utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const deploy = await hre.deployments.deploy('SwapperRegistry', {
    contract: 'contracts/SwapperRegistry.sol:SwapperRegistry',
    from: deployer,
    args: [governor],
    log: true,
  });

  if (shouldVerifyContracts()) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor],
    });
  }
};
deployFunction.tags = ['SwapperRegistry'];
export default deployFunction;
