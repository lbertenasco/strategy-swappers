import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { behaviours, constants, contracts, erc20, wallet } from '../utils';
import { contract, given, then, when } from '../utils/bdd';
import { BigNumber } from '@ethersproject/bignumber';
import { utils } from 'ethers';

contract('Swapper', () => {
  let governor: SignerWithAddress;
  let tradeFactory: SignerWithAddress;
  let swapperFactory: ContractFactory;
  let swapper: Contract;

  before(async () => {
    [governor, tradeFactory] = await ethers.getSigners();
    swapperFactory = await ethers.getContractFactory('contracts/mock/Swapper.sol:SwapperMock');
  });

  beforeEach(async () => {
    swapper = await swapperFactory.deploy(governor.address, tradeFactory.address);
  });

  describe('constructor', () => {
    // when('governor is zero address', () => {
    //   let deploymentTx: Promise<TransactionResponse>;
    //   given(async () => {
    //     const deployment = await contracts.deploy(swapperFactory, [constants.ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS]);
    //     deploymentTx = deployment.tx.wait();
    //   });
    //   then('tx is reverted with reason', async () => {
    //     await expect(deploymentTx).to.be.reverted;
    //   });
    // });
    when('trade factory is zero address', () => {
      then('tx is reverted with reason', async () => {
        await behaviours.deployShouldRevertWithZeroAddress({
          contract: swapperFactory,
          args: [constants.NOT_ZERO_ADDRESS, constants.ZERO_ADDRESS],
        });
      });
    });
    when('data is valid', () => {
      let deploymentTx: TransactionResponse;
      let deploymentContract: Contract;
      given(async () => {
        const deployment = await contracts.deploy(swapperFactory, [governor.address, tradeFactory.address]);
        deploymentTx = deployment.tx as TransactionResponse;
        deploymentContract = deployment.contract!;
      });
      then('governor is set', async () => {
        expect(await deploymentContract.governor()).to.be.equal(governor.address);
      });
      then('trade factory is set', async () => {
        expect(await deploymentContract.TRADE_FACTORY()).to.be.equal(tradeFactory.address);
      });
    });
  });

  describe('onlyTradeFactory', () => {
    behaviours.shouldBeExecutableOnlyByTradeFactory({
      contract: () => swapper,
      funcAndSignature: 'modifierOnlyTradeFactory()',
      params: [],
      tradeFactory: () => tradeFactory,
    });
  });

  describe('assertPreSwap', () => {
    behaviours.shouldBeCheckPreAssetSwap({
      contract: () => swapper,
      func: 'assertPreSwap',
      withData: false,
    });
  });

  describe('swap', () => {
    behaviours.shouldBeExecutableOnlyByTradeFactory({
      contract: () => swapper,
      funcAndSignature: 'swap(address,address,address,uint256,uint256,bytes)',
      params: [constants.ZERO_ADDRESS, constants.ZERO_ADDRESS, constants.ZERO_ADDRESS, constants.ZERO, constants.ZERO, '0x'],
      tradeFactory: () => tradeFactory,
    });
    behaviours.shouldBeCheckPreAssetSwap({
      contract: () => swapper.connect(tradeFactory),
      func: 'swap',
      withData: true,
    });
    when('everything is valid', () => {
      let tokenIn: Contract;
      let swapTx: TransactionResponse;
      let receiver: string;
      let tokenOut: string;
      const amount = utils.parseEther('10');
      const maxSlippage = BigNumber.from('1000');
      const data = contracts.encodeParameters(['uint256'], [constants.MAX_UINT_256]);
      given(async () => {
        receiver = await wallet.generateRandomAddress();
        tokenOut = await wallet.generateRandomAddress();
        tokenIn = await erc20.deploy({
          initialAccount: tradeFactory.address,
          initialAmount: amount,
          name: 'Token In',
          symbol: 'TI',
        });
        await tokenIn.connect(tradeFactory).approve(swapper.address, amount);
        swapTx = await swapper.connect(tradeFactory).swap(receiver, tokenIn.address, tokenOut, amount, maxSlippage, data);
      });
      then('takes tokens from caller', async () => {
        expect(await tokenIn.balanceOf(tradeFactory.address)).to.equal(0);
      });
      then('sends tokens to swapper', async () => {
        expect(await tokenIn.balanceOf(swapper.address)).to.equal(amount);
      });
      then('can decode data correctly', async () => {
        await expect(swapTx).to.emit(swapper, 'DecodedData').withArgs(constants.MAX_UINT_256);
      });
      then('executes internal swap', async () => {
        await expect(swapTx).to.emit(swapper, 'MyInternalExecuteSwap').withArgs(receiver, tokenIn.address, tokenOut, amount, maxSlippage, data);
      });
      then('emits event with correct information', async () => {
        await expect(swapTx).to.emit(swapper, 'Swapped').withArgs(receiver, tokenIn.address, tokenOut, amount, maxSlippage, 1000, data);
      });
    });
  });

  describe('sendDust', () => {
    // only governor
  });
});
