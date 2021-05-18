import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

const deploy = async ({
  name,
  symbol,
  decimals,
  initialAccount,
  initialAmount,
}: {
  name: string;
  symbol: string;
  decimals?: BigNumber | number;
  initialAccount: string;
  initialAmount: BigNumber;
}): Promise<Contract> => {
  const erc20MockContract = await ethers.getContractFactory('contracts/mock/ERC20Mock.sol:ERC20Mock');
  const deployedContract = await erc20MockContract.deploy(name, symbol, initialAccount, initialAmount);
  return deployedContract;
};

export default {
  deploy,
};
