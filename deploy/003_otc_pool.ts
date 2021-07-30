import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '../utils/deploy';

const OTC_PROVIDER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xfeb4acf3df3cdea7399794d0869ef76a6efaff52', // ychad.eth
  // Polygon
  '137': '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', // yMech alejo
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor, yMech } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  const deploy = await hre.deployments.deploy('OTCPool', {
    contract: 'contracts/OTCPool/OTCPool.sol:OTCPool',
    from: deployer,
    args: [governor, OTC_PROVIDER[chainId]],
    log: true,
  });

  if (await shouldVerifyContract(hre, 'OTCPool')) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, OTC_PROVIDER[chainId]],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['OTCPool'];
export default deployFunction;
