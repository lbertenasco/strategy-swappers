import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '../utils/deploy';

const OTC_PROVIDER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xfeb4acf3df3cdea7399794d0869ef76a6efaff52', // ychad.eth
  // Polygon
  '137': '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', // yMech alejo
  // Fantom
  '250': '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', // yMech alejo
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor, yMech } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  const tradeFactory = await hre.deployments.get('TradeFactory');

  const deploy = await hre.deployments.deploy('OTCPool', {
    contract: 'contracts/OTCPool.sol:OTCPool',
    from: deployer,
    args: [governor, tradeFactory.address],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address],
    });
  }
};
deployFunction.dependencies = ['TradeFactory'];
deployFunction.tags = ['Common', 'OTCPool'];
export default deployFunction;
