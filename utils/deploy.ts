import { HardhatNetworkUserConfig, HardhatRuntimeEnvironment } from 'hardhat/types';

export const getRealChainIdOfFork = (hre: HardhatRuntimeEnvironment): number | undefined => {
  const config = hre.network.config as HardhatNetworkUserConfig;
  if (config.forking?.url.includes('mainnet')) return 1;
  if (config.forking?.url.includes('polygon')) return 137;
};

export const shouldVerifyContracts = (): boolean => {
  return !process.env.FORK && !process.env.TEST;
};
