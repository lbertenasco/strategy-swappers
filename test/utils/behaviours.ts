import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
import { Contract, ContractFactory, ContractInterface, Signer, Wallet } from 'ethers';
import { TransactionRequest, TransactionResponse } from '@ethersproject/abstract-provider';
import { getStatic } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants, wallet } from '.';
import { given, then, when } from './bdd';

chai.use(chaiAsPromised);

const checkTxRevertedWithMessage = async ({ tx, message }: { tx: Promise<TransactionResponse>; message: RegExp | string }): Promise<void> => {
  await expect(tx).to.be.reverted;
  if (message instanceof RegExp) {
    await expect(tx).eventually.rejected.have.property('message').match(message);
  } else {
    await expect(tx).to.be.revertedWith(message);
  }
};

const checkTxRevertedWithZeroAddress = async (tx: Promise<TransactionResponse>): Promise<void> => {
  await checkTxRevertedWithMessage({
    tx,
    message: /zero\saddress/,
  });
};

const deployShouldRevertWithZeroAddress = async ({ contract, args }: { contract: ContractFactory; args: any[] }): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = contract.signer.sendTransaction(deployContractTx);
  await checkTxRevertedWithZeroAddress(tx);
};

const deployShouldRevertWithMessage = async ({
  contract,
  args,
  message,
}: {
  contract: ContractFactory;
  args: any[];
  message: string;
}): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = contract.signer.sendTransaction(deployContractTx);
  await checkTxRevertedWithMessage({ tx, message });
};

const txShouldRevertWithZeroAddress = async ({
  contract,
  func,
  args,
}: {
  contract: Contract;
  func: string;
  args: any[];
  tx?: Promise<TransactionRequest>;
}): Promise<void> => {
  const tx = contract[func].apply(this, args);
  await checkTxRevertedWithZeroAddress(tx);
};

const txShouldRevertWithMessage = async ({
  contract,
  func,
  args,
  message,
}: {
  contract: Contract;
  func: string;
  args: any[];
  message: string;
}): Promise<void> => {
  const tx = contract[func].apply(this, args);
  await checkTxRevertedWithMessage({ tx, message });
};

const checkTxEmittedEvents = async ({
  contract,
  tx,
  events,
}: {
  contract: Contract;
  tx: TransactionResponse;
  events: { name: string; args: any[] }[];
}): Promise<void> => {
  for (let i = 0; i < events.length; i++) {
    expect(tx)
      .to.emit(contract, events[i].name)
      .withArgs(...events[i].args);
  }
};

const deployShouldSetVariablesAndEmitEvents = async ({
  contract,
  args,
  settersGettersVariablesAndEvents,
}: {
  contract: ContractFactory;
  args: any[];
  settersGettersVariablesAndEvents: {
    getterFunc: string;
    variable: any;
    eventEmitted: string;
  }[];
}): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = await contract.signer.sendTransaction(deployContractTx);
  const address = getStatic<(tx: TransactionResponse) => string>(contract.constructor, 'getContractAddress')(tx);
  const deployedContract = getStatic<(address: string, contractInterface: ContractInterface, signer?: Signer) => Contract>(
    contract.constructor,
    'getContract'
  )(address, contract.interface, contract.signer);
  await txShouldHaveSetVariablesAndEmitEvents({
    contract: deployedContract,
    tx,
    settersGettersVariablesAndEvents,
  });
};

const txShouldHaveSetVariablesAndEmitEvents = async ({
  contract,
  tx,
  settersGettersVariablesAndEvents,
}: {
  contract: Contract;
  tx: TransactionResponse;
  settersGettersVariablesAndEvents: {
    getterFunc: string;
    variable: any;
    eventEmitted: string;
  }[];
}): Promise<void> => {
  for (let i = 0; i < settersGettersVariablesAndEvents.length; i++) {
    await checkTxEmittedEvents({
      contract,
      tx,
      events: [
        {
          name: settersGettersVariablesAndEvents[i].eventEmitted,
          args: [settersGettersVariablesAndEvents[i].variable],
        },
      ],
    });
    expect(await contract[settersGettersVariablesAndEvents[i].getterFunc].apply(this)).to.eq(settersGettersVariablesAndEvents[i].variable);
  }
};

const txShouldSetVariableAndEmitEvent = async ({
  contract,
  setterFunc,
  getterFunc,
  variable,
  eventEmitted,
}: {
  contract: Contract;
  setterFunc: string;
  getterFunc: string;
  variable: any;
  eventEmitted: string;
}): Promise<void> => {
  expect(await contract[getterFunc].apply(this)).to.not.eq(variable);
  const tx = contract[setterFunc].apply(this, [variable]);
  await txShouldHaveSetVariablesAndEmitEvents({
    contract,
    tx,
    settersGettersVariablesAndEvents: [
      {
        getterFunc,
        variable,
        eventEmitted,
      },
    ],
  });
};

const shouldBeExecutableOnlyByTradeFactory = ({
  contract,
  funcAndSignature,
  params,
  tradeFactory,
}: {
  contract: () => Contract;
  funcAndSignature: string;
  params?: any[];
  tradeFactory: () => SignerWithAddress | Wallet;
}) => {
  params = params ?? [];
  when('not called from trade factory', () => {
    let onlyTradeFactoryAllowedTx: Promise<TransactionResponse>;
    given(async () => {
      const notGovernor = await wallet.generateRandom();
      onlyTradeFactoryAllowedTx = contract()
        .connect(notGovernor)
        [funcAndSignature](...params!, { gasPrice: 0 });
    });
    then('tx is reverted with reason', async () => {
      await expect(onlyTradeFactoryAllowedTx).to.be.revertedWith('Swapper: not trade factory');
    });
  });
  when('called from factory', () => {
    let onlyTradeFactoryAllowedTx: Promise<TransactionResponse>;
    given(async () => {
      onlyTradeFactoryAllowedTx = contract()
        .connect(tradeFactory())
        [funcAndSignature](...params!, { gasPrice: 0 });
    });
    then('tx is not reverted or not reverted with reason only trade factory', async () => {
      await expect(onlyTradeFactoryAllowedTx).to.not.be.revertedWith('Swapper: not trade factory');
    });
  });
};

const shouldBeCheckPreAssetSwap = ({ contract, func }: { contract: () => Contract; func: string }) => {
  when('receiver is zero address', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      tx = contract()[func](constants.ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, constants.ONE, constants.ONE);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('Swapper: zero address');
    });
  });
  when('token in is zero address', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      tx = contract()[func](constants.NOT_ZERO_ADDRESS, constants.ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, constants.ONE, constants.ONE);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('Swapper: zero address');
    });
  });
  when('token out is zero address', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      tx = contract()[func](constants.NOT_ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, constants.ZERO_ADDRESS, constants.ONE, constants.ONE);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('Swapper: zero address');
    });
  });
  when('amount is zero', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      tx = contract()[func](constants.NOT_ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, constants.ZERO, constants.ONE);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('Swapper: zero amount');
    });
  });
  when('max slippage is zero', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      tx = contract()[func](constants.NOT_ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, constants.ONE, constants.ZERO);
    });
    then('tx is reverted with reason', async () => {
      await expect(tx).to.be.revertedWith('Swapper: zero slippage');
    });
  });
};

export default {
  deployShouldRevertWithMessage,
  deployShouldRevertWithZeroAddress,
  txShouldRevertWithZeroAddress,
  txShouldRevertWithMessage,
  deployShouldSetVariablesAndEmitEvents,
  txShouldHaveSetVariablesAndEmitEvents,
  txShouldSetVariableAndEmitEvent,
  checkTxRevertedWithMessage,
  shouldBeExecutableOnlyByTradeFactory,
  shouldBeCheckPreAssetSwap,
};
