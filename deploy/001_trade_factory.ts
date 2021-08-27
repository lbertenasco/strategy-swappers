import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getChainId, shouldVerifyContract } from '../utils/deploy';

export const MECHANICS_REGISTRY: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xe8d5a85758fe98f7dce251cad552691d49b499bb',
  // Polygon
  '137': '0x7a99923aa2efa71178bb11294349ec1f6b23a814',
};

export const MASTER_ADMIN: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // TODO: Change and put the real address
  // Polygon
  '137': '0x31ABE8B1A645ac2d81201869d6eC77CF192e7d7F',
};

export const SWAPPER_ADDER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // TODO: Change and put the real address
  // Polygon
  '137': '0x31ABE8B1A645ac2d81201869d6eC77CF192e7d7F',
};

export const SWAPPER_SETTER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // TODO: Change and put the real address
  // Polygon
  '137': '0x31ABE8B1A645ac2d81201869d6eC77CF192e7d7F',
};

export const STRATEGY_ADDER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // TODO: Change and put the real address
  // Polygon
  '137': '0x31ABE8B1A645ac2d81201869d6eC77CF192e7d7F',
};

export const TRADE_MODIFIER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // TODO: Change and put the real address
  // Polygon
  '137': '0x31ABE8B1A645ac2d81201869d6eC77CF192e7d7F',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  const deploy = await hre.deployments.deploy('TradeFactory', {
    contract: 'contracts/TradeFactory/TradeFactory.sol:TradeFactory',
    from: deployer,
    args: [
      MASTER_ADMIN[chainId],
      SWAPPER_ADDER[chainId],
      SWAPPER_SETTER[chainId],
      STRATEGY_ADDER[chainId],
      TRADE_MODIFIER[chainId],
      MECHANICS_REGISTRY[chainId],
    ],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [
        MASTER_ADMIN[chainId],
        SWAPPER_ADDER[chainId],
        SWAPPER_SETTER[chainId],
        STRATEGY_ADDER[chainId],
        TRADE_MODIFIER[chainId],
        MECHANICS_REGISTRY[chainId],
      ],
    });
  }
};
deployFunction.dependencies = [];
deployFunction.tags = ['TradeFactory'];
export default deployFunction;
