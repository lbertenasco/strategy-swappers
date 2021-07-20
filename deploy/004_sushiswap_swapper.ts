import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { abi as UNISWAP_V2_ROUTER_ABI } from '@uniswap/v2-periphery/build/UniswapV2Router02.json';
import { ethers } from 'hardhat';

export const SUSHISWAP_FACTORY: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  // Polygon
  '137': '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
};

export const SUSHISWAP_ROUTER: { [chainId: string]: string } = {
  // Mainnet
  '1': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  // Polygon
  '137': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  const chainId = await hre.getChainId();
  const sushiswapRouter = await ethers.getContractAt(UNISWAP_V2_ROUTER_ABI, SUSHISWAP_ROUTER[chainId]);
  const tradeFactory = await hre.deployments.get('TradeFactory');
  const WETH = await sushiswapRouter.WETH();

  const deploy = await hre.deployments.deploy('SushiswapSwapper', {
    contract: 'contracts/swappers/UniswapV2Swapper.sol:UniswapV2Swapper',
    from: deployer,
    args: [governor, tradeFactory.address, WETH, SUSHISWAP_FACTORY[chainId], SUSHISWAP_ROUTER[chainId]],
    log: true,
  });

  await hre.deployments.execute('SwapperRegistry', { from: governor, gasLimit: 200000 }, 'addSwapper', 'sushiswap', deploy.address);

  if (!process.env.TEST) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [governor, tradeFactory.address, WETH, SUSHISWAP_FACTORY[chainId], SUSHISWAP_ROUTER[chainId]],
    });
  }
};
deployFunction.dependencies = ['SwapperRegistry', 'TradeFactory'];
deployFunction.tags = ['SushiswapSwapper', 'Polygon', 'Mainnet'];
export default deployFunction;
