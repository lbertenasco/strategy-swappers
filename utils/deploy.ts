import { HardhatNetworkUserConfig, HardhatRuntimeEnvironment } from 'hardhat/types';

let testChainId: number;

export const setTestChainId = (chainId: number): void => {
  testChainId = chainId;
};

export const getChainId = async (hre: HardhatRuntimeEnvironment): Promise<number> => {
  if (!!process.env.TEST) {
    if (!testChainId) throw new Error('Should specify chain id of test');
    return testChainId;
  }
  if (!!process.env.FORK) return getRealChainIdOfFork(hre);
  return await (hre as any).getChainId();
};

export const getRealChainIdOfFork = (hre: HardhatRuntimeEnvironment): number => {
  const config = hre.network.config as HardhatNetworkUserConfig;
  if (config.forking?.url.includes('mainnet')) return 1;
  if (config.forking?.url.includes('polygon')) return 137;
  throw new Error('Should specify chain id of fork');
};

export const shouldVerifyContracts = (): boolean => {
  return !process.env.FORK && !process.env.TEST;
};
