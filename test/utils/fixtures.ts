import {
  abi as MECHANICS_REGISTRY_ABI,
  bytecode as MECHANICS_REGISTRY_EVMCODE,
} from '@lbertenasco/contract-utils/artifacts/contracts/mechanics/MechanicsRegistry.sol/MechanicsRegistry.json';
import {
  abi as MACHINERY_ABI,
  bytecode as MACHINERY_BYTECODE,
} from '@lbertenasco/contract-utils/artifacts/contracts/utils/Machinery.sol/Machinery.json';
import { deployContract } from 'ethereum-waffle';
import { Contract, utils } from 'ethers';
import { ethers } from 'hardhat';
import uniswap from './uniswap';
import wallet from './wallet';
interface MechanicsRegistryFixture {
  mechanicsRegistry: Contract;
}

export const mechanicsRegistryFixture = async (mechanic: string): Promise<MechanicsRegistryFixture> => {
  const [deployer] = await ethers.getSigners();
  const mechanicsRegistry = await deployContract(deployer, { abi: MECHANICS_REGISTRY_ABI, bytecode: MECHANICS_REGISTRY_EVMCODE }, [mechanic]);
  return { mechanicsRegistry };
};

interface MachineryFixture extends MechanicsRegistryFixture {
  machinery: Contract;
}

export const machineryFixture = async (mechanic: string): Promise<MachineryFixture> => {
  const { mechanicsRegistry } = await mechanicsRegistryFixture(mechanic);
  const [deployer] = await ethers.getSigners();
  const machinery = await deployContract(deployer, { abi: MACHINERY_ABI, bytecode: MACHINERY_BYTECODE }, [mechanicsRegistry.address]);
  return { mechanicsRegistry, machinery };
};

interface TradeFactoryFixture {
  tradeFactory: Contract;
}

export const tradeFactoryFixture = async (governor: string, feeRecipient: string, mechanicsRegistry: string): Promise<TradeFactoryFixture> => {
  const tradeFactoryFactory = await ethers.getContractFactory('contracts/TradeFactory/TradeFactory.sol:TradeFactory');
  const tradeFactory = await tradeFactoryFactory.deploy(governor, feeRecipient, mechanicsRegistry);
  return {
    tradeFactory,
  };
};

interface UniswapV2SwapperFixture extends TradeFactoryFixture {
  WETH: Contract;
  uniswapV2Factory: Contract;
  uniswapV2Router02: Contract;
  uniswapV2Swapper: Contract;
}

export const uniswapV2AsyncSwapperFixture = async (
  governor: string,
  feeRecipient: string,
  mechanicsRegistry: string
): Promise<UniswapV2SwapperFixture> => {
  const { tradeFactory } = await tradeFactoryFixture(governor, feeRecipient, mechanicsRegistry);
  const uniswapV2SwapperFactory = await ethers.getContractFactory('contracts/swappers/async/UniswapV2AsyncSwapper.sol:UniswapV2Swapper');
  const owner = await wallet.generateRandom();
  await ethers.provider.send('hardhat_setBalance', [owner.address, utils.parseEther('10').toHexString()]);
  const uniswapDeployment = await uniswap.deploy({ owner });
  const uniswapV2Swapper = await uniswapV2SwapperFactory.deploy(
    governor,
    tradeFactory.address,
    uniswapDeployment.WETH.address,
    uniswapDeployment.uniswapV2Factory.address,
    uniswapDeployment.uniswapV2Router02.address
  );
  await tradeFactory.addSwapper(uniswapV2Swapper.address);
  return {
    tradeFactory,
    uniswapV2Swapper,
    ...uniswapDeployment,
  };
};
