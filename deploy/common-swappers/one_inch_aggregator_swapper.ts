import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '../../utils/deploy';

const AGGREGATION_ROUTER_V3: { [chainId: string]: string } = {
  // Mainnet
  '1': '0x11111112542D85B3EF69AE05771c2dCCff4fAa26',
  // Polygon
  '137': '0x11111112542D85B3EF69AE05771c2dCCff4fAa26',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const chainId = await getChainId(hre);

  const deploy = await hre.deployments.deploy('OneInchAggregatorSwapper', {
    contract: 'contracts/swappers/async/OneInchAggregatorSwapper.sol:OneInchAggregatorSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, AGGREGATION_ROUTER_V3[chainId]],
    log: true,
  });

  await hre.deployments.execute('TradeFactory', { from: governor, gasLimit: 200000 }, 'addSwapper', deploy.address);

  if (await shouldVerifyContract(hre, 'OneInchAggregatorSwapper')) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address, AGGREGATION_ROUTER_V3[chainId]],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['OneInchAggregatorSwapper'];
export default deployFunction;
