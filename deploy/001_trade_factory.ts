import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '../utils/deploy';

const MECHANICS_REGISTRY: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xe8d5a85758fe98f7dce251cad552691d49b499bb',
  // Polygon
  '137': '0x7a99923aa2efa71178bb11294349ec1f6b23a814',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  const deploy = await hre.deployments.deploy('TradeFactory', {
    contract: 'contracts/TradeFactory/TradeFactory.sol:TradeFactory',
    from: deployer,
    args: [governor, MECHANICS_REGISTRY[chainId]],
    log: true,
  });

  if (await shouldVerifyContract(hre, 'TradeFactory')) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, MECHANICS_REGISTRY[chainId]],
    });
  }
};
deployFunction.dependencies = [];
deployFunction.tags = ['TradeFactory'];
export default deployFunction;
