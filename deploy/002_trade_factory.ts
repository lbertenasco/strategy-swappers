import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const MECHANICS_REGISTRY = '0xe8d5a85758fe98f7dce251cad552691d49b499bb';
  const swapperRegistry = await hre.deployments.get('SwapperRegistry');

  await hre.deployments.deploy('TradeFactory', {
    contract: 'contracts/TradeFactory/TradeFactory.sol:TradeFactory',
    from: deployer,
    args: [governor, MECHANICS_REGISTRY, swapperRegistry.address],
    log: true,
  });
};
export default deployFunction;
deployFunction.dependencies = ['SwapperRegistry'];
deployFunction.tags = ['TradeFactory'];
