import { Contract, ContractFactory } from '@ethersproject/contracts';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { ContractInterface, Signer, Transaction } from 'ethers';
import { getStatic } from 'ethers/lib/utils';

const deploy = async (
  contract: ContractFactory,
  args: any[]
): Promise<{ tx: Promise<TransactionResponse> | TransactionResponse; contract?: Contract }> => {
  const deploymentTransactionRequest = await contract.getDeployTransaction(...args);
  const deploymentTx = contract.signer.sendTransaction(deploymentTransactionRequest);
  let deployedContract: Contract;
  try {
    const tx = await deploymentTx;
    const contractAddress = getStatic<(deploymentTx: TransactionResponse) => string>(contract.constructor, 'getContractAddress')(tx);
    deployedContract = getStatic<(contractAddress: string, contractInterface: ContractInterface, signer?: Signer) => Contract>(
      contract.constructor,
      'getContract'
    )(contractAddress, contract.interface, contract.signer);
    return {
      tx: tx,
      contract: deployedContract,
    };
  } catch (err) {
    return {
      tx: deploymentTx,
    };
  }
};

export default {
  deploy,
};
