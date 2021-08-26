import { utils, Wallet } from 'ethers';
import { getAddress } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import { randomHex } from 'web3-utils';
import { JsonRpcSigner } from '@ethersproject/providers';

const impersonate = async (address: string): Promise<JsonRpcSigner> => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  await network.provider.send('hardhat_setBalance', [address, '0xffffffffffffffff']);
  return ethers.provider.getSigner(address);
};

const generateRandom = async () => {
  const wallet = (await Wallet.createRandom()).connect(ethers.provider);
  await network.provider.send('hardhat_setBalance', [wallet.address, '0xffffffffffffffff']);
  return wallet;
};

const generateRandomAddress = () => {
  return getAddress(randomHex(20));
};

export default {
  generateRandom,
  generateRandomAddress,
  impersonate,
};
