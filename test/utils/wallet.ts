import { Wallet } from 'ethers';
import { getAddress } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { randomHex } from 'web3-utils';

const generateRandom = async () => {
  const wallet = (await Wallet.createRandom()).connect(ethers.provider);
  return wallet;
};

const generateRandomAddress = () => {
  return getAddress(randomHex(20));
};

export default {
  generateRandom,
  generateRandomAddress,
};
