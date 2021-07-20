import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { abi as UNISWAP_V2_ROUTER_ABI } from '@uniswap/v2-periphery/build/UniswapV2Router02.json';
import { ethers, network } from 'hardhat';
import { getChainId, shouldVerifyContracts } from '../utils/deploy';

const SUSHISWAP_FACTORY: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  // Polygon
  '137': '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
};

const SUSHISWAP_ROUTER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  // Polygon
  '137': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
};

const WETH: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  // Polygon
  '137': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);
  const tradeFactory = await hre.deployments.get('TradeFactory');

  const deploy = await hre.deployments.deploy('SushiswapSwapper', {
    contract: 'contracts/swappers/UniswapV2Swapper.sol:UniswapV2Swapper',
    from: deployer,
    args: [governor, tradeFactory.address, WETH[chainId], SUSHISWAP_FACTORY[chainId], SUSHISWAP_ROUTER[chainId]],
    log: true,
  });

  await hre.deployments.execute('SwapperRegistry', { from: governor, gasLimit: 200000 }, 'addSwapper', 'sushiswap', deploy.address);

  if (shouldVerifyContracts()) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address, WETH[chainId], SUSHISWAP_FACTORY[chainId], SUSHISWAP_ROUTER[chainId]],
    });
  }
};
deployFunction.dependencies = ['SwapperRegistry', 'TradeFactory'];
deployFunction.tags = ['SushiswapSwapper', 'Polygon', 'Mainnet'];
export default deployFunction;
