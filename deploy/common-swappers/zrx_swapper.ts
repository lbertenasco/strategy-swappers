import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '../../utils/deploy';

const ZRX: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  // Polygon
  '137': '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const chainId = await getChainId(hre);

  const deploy = await hre.deployments.deploy('ZRXSwapper', {
    contract: 'contracts/swappers/async/ZRXSwapper.sol:ZRXSwapper',
    from: deployer,
    args: [governor, tradeFactory.address, ZRX[chainId]],
    log: true,
  });

  await hre.deployments.execute('TradeFactory', { from: governor, gasLimit: 200000 }, 'addSwapper', deploy.address);

  if (await shouldVerifyContract(hre, 'ZRXSwapper')) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address, ZRX[chainId]],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['ZRXSwapper'];
export default deployFunction;
