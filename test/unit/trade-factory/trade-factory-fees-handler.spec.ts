import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '../../utils/bdd';
import { smoddit, ModifiableContractFactory, ModifiableContract } from '@eth-optimism/smock';
import { constants, erc20, wallet } from '../../utils';
import Web3 from 'web3';
import { BigNumber, Contract, utils } from 'ethers';

contract('TradeFactoryFeesHandler', () => {
  let deployer: SignerWithAddress;
  let governor: SignerWithAddress;
  let feeReceiver: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let feesHandlerFactory: ModifiableContractFactory;
  let feesHandler: ModifiableContract;
  let defaultSwapperAddress: string;

  const MASTER_ADMIN_ROLE: string = new Web3().utils.soliditySha3('MASTER_ADMIN') as string;
  const FEE_SETTER_ROLE: string = new Web3().utils.soliditySha3('FEE_SETTER') as string;

  before(async () => {
    [deployer, feeReceiver, governor, swapperSetter] = await ethers.getSigners();
    feesHandlerFactory = await smoddit('contracts/mock/TradeFactory/TradeFactoryFeesHandler.sol:TradeFactoryFeesHandlerMock');
  });

  beforeEach(async () => {
    feesHandler = await feesHandlerFactory.deploy(governor.address, feeReceiver.address);
    defaultSwapperAddress = wallet.generateRandomAddress();
    await feesHandler.connect(governor).addSwapper(defaultSwapperAddress);
  });

  describe('constructor', () => {
    // TODO: Make it better
    when('all data is valid', () => {
      then('governor is set correctly', async () => {
        expect(await feesHandler.governor()).to.equal(governor.address);
      });
      then('role admin of strategy is strategy admin', async () => {
        expect(await feesHandler.getRoleAdmin(FEE_SETTER_ROLE)).to.equal(MASTER_ADMIN_ROLE);
      });
      then('governor has strategy admin role', async () => {
        expect(await feesHandler.hasRole(FEE_SETTER_ROLE, governor.address)).to.be.true;
      });
    });
  });

  describe('grantRole', () => {
    when('granting FEE_SETTER_ROLE', () => {
      const randomEOA = wallet.generateRandomAddress();
      when('not called from governor', () => {
        let grantRoleTx: Promise<TransactionResponse>;
        given(() => {
          grantRoleTx = feesHandler.connect(deployer).grantRole(FEE_SETTER_ROLE, randomEOA);
        });
        then('tx get reverted with reason', async () => {
          await expect(grantRoleTx).to.be.reverted;
        });
      });
      when('called from governor', () => {
        given(async () => {
          await feesHandler.connect(governor).grantRole(FEE_SETTER_ROLE, randomEOA);
        });
        then('role gets added to address', async () => {
          expect(await feesHandler.hasRole(FEE_SETTER_ROLE, randomEOA)).to.be.true;
        });
      });
    });
  });

  describe('revokeRole', () => {
    const randomEOA = wallet.generateRandomAddress();
    when('revoking FEE_SETTER_ROLE', () => {
      given(async () => {
        await feesHandler.connect(governor).grantRole(FEE_SETTER_ROLE, randomEOA);
      });
      when('not called from governor', () => {
        let grantRoleTx: Promise<TransactionResponse>;
        given(() => {
          grantRoleTx = feesHandler.connect(deployer).revokeRole(FEE_SETTER_ROLE, randomEOA);
        });
        then('tx get reverted with reason', async () => {
          await expect(grantRoleTx).to.be.reverted;
        });
      });
      when('called from governor', () => {
        given(async () => {
          await feesHandler.connect(governor).revokeRole(FEE_SETTER_ROLE, randomEOA);
        });
        then('role gets removed from address', async () => {
          expect(await feesHandler.hasRole(FEE_SETTER_ROLE, randomEOA)).to.be.false;
        });
      });
    });
  });

  describe('setMaxFee()', () => {
    let maxFee: BigNumber;
    before(async () => {
      maxFee = (await feesHandler.MAX_FEE()).div(10);
      await feesHandler.connect(governor).grantRole(FEE_SETTER_ROLE, deployer.address);
    });
    when('updating maxFee', () => {
      given(async () => {
        await feesHandler.connect(governor).setMaxFee(maxFee);
      });
      when('not called from MASTER_ADMIN', () => {
        let setMaxFeeTx: Promise<TransactionResponse>;
        given(() => {
          setMaxFeeTx = feesHandler.connect(deployer).setMaxFee(maxFee);
        });
        then('tx get reverted with reason', async () => {
          await expect(setMaxFeeTx).to.be.reverted;
        });
      });
      when('max fee exceeds precision', () => {
        let setMaxFeeTx: Promise<TransactionResponse>;
        given(async () => {
          setMaxFeeTx = feesHandler.connect(governor).setMaxFee((await feesHandler.MAX_FEE()).add(1));
        });
        then('tx get reverted with reason', async () => {
          await expect(setMaxFeeTx).to.be.reverted;
        });
      });
      when('called from governor', () => {
        given(async () => {
          await feesHandler.connect(governor).setMaxFee(maxFee);
        });
        then('fee receiver gets updated', async () => {
          expect(await feesHandler.maxFee()).to.be.eq(maxFee);
        });
      });
    });
  });

  describe('setFeeReceiver()', () => {
    const randomEOA = wallet.generateRandomAddress();
    when('setting new feeReceiver', () => {
      given(async () => {
        await feesHandler.connect(governor).setFeeReceiver(randomEOA);
      });
      when('not called from FEE_SETTER', () => {
        let setFeeReceiverTx: Promise<TransactionResponse>;
        given(() => {
          setFeeReceiverTx = feesHandler.connect(deployer).setFeeReceiver(randomEOA);
        });
        then('tx get reverted with reason', async () => {
          await expect(setFeeReceiverTx).to.be.reverted;
        });
      });
      when('called with zero address', () => {
        let setFeeReceiverTx: Promise<TransactionResponse>;
        given(() => {
          setFeeReceiverTx = feesHandler.connect(governor).setFeeReceiver(constants.ZERO_ADDRESS);
        });
        then('tx get reverted with reason', async () => {
          await expect(setFeeReceiverTx).to.be.reverted;
        });
      });
      when('called from governor', () => {
        given(async () => {
          await feesHandler.connect(governor).setFeeReceiver(randomEOA);
        });
        then('fee receiver gets updated', async () => {
          expect(await feesHandler.feeReceiver()).to.be.eq(randomEOA);
        });
      });
    });
  });

  describe('setSwapperFee()', () => {
    let swapperFee: BigNumber;
    beforeEach(async () => {
      swapperFee = (await feesHandler.MAX_FEE()).div(10);
    });
    when('updating swapper fees', () => {
      given(async () => {
        await feesHandler.connect(governor).setSwapperFee(defaultSwapperAddress, swapperFee);
      });
      when('not called from FEE_SETTER', () => {
        let setSwapperFeeTx: Promise<TransactionResponse>;
        given(() => {
          setSwapperFeeTx = feesHandler.connect(deployer).setSwapperFee(defaultSwapperAddress, swapperFee);
        });
        then('tx get reverted with reason', async () => {
          await expect(setSwapperFeeTx).to.be.reverted;
        });
      });
      when('called from FEE_SETTER', () => {
        let setSwapperFeeTx: Promise<TransactionResponse>;
        given(async () => {
          await feesHandler.connect(governor).grantRole(FEE_SETTER_ROLE, swapperSetter.address);
          setSwapperFeeTx = feesHandler.connect(swapperSetter).setSwapperFee(defaultSwapperAddress, swapperFee);
        });
        then('swapper fee gets updated', async () => {
          expect(await feesHandler.swapperFee(defaultSwapperAddress)).to.be.eq(swapperFee);
        });
      });
      when('called with invalid swapper', () => {
        let setSwapperFeeTx: Promise<TransactionResponse>;
        given(() => {
          setSwapperFeeTx = feesHandler.connect(governor).setSwapperFee(constants.ZERO_ADDRESS, swapperFee);
        });
        then('tx get reverted with reason', async () => {
          await expect(setSwapperFeeTx).to.be.reverted;
        });
      });
      when('called with max fee', () => {
        let setSwapperFeeTx: Promise<TransactionResponse>;
        given(async () => {
          setSwapperFeeTx = feesHandler.connect(governor).setSwapperFee(defaultSwapperAddress, (await feesHandler.maxFee()).add(1));
        });
        then('tx get reverted with reason', async () => {
          await expect(setSwapperFeeTx).to.be.reverted;
        });
      });
      when('called from governor', () => {
        given(async () => {
          await feesHandler.connect(governor).setSwapperFee(defaultSwapperAddress, swapperFee);
        });
        then('swapper fee gets updated', async () => {
          expect(await feesHandler.swapperFee(defaultSwapperAddress)).to.be.eq(swapperFee);
        });
      });
    });
  });

  describe('processFees()', () => {
    let swapperFee: BigNumber;
    const feeReceiverAddress = wallet.generateRandomAddress();
    const amountIn = utils.parseEther('100');
    let token: Contract;
    beforeEach(async () => {
      swapperFee = (await feesHandler.maxFee()).div(10);
      await feesHandler.connect(governor).setFeeReceiver(feeReceiverAddress);
      await feesHandler.connect(governor).setSwapperFee(defaultSwapperAddress, swapperFee);
      token = await erc20.deploy({
        symbol: 'TK',
        name: 'Token',
        initialAccount: governor.address,
        initialAmount: BigNumber.from(0),
      });
      await token.connect(governor).mint(feesHandler.address, amountIn);
    });
    when('processing fees', () => {
      when('fee is zero', () => {
        given(async () => {
          await feesHandler.connect(governor).setSwapperFee(defaultSwapperAddress, 0);
          await feesHandler.connect(governor).processFees(defaultSwapperAddress, token.address, amountIn);
        });
        then('feeReceiver gets 0 tokens', async () => {
          expect(await token.balanceOf(feeReceiverAddress)).to.be.eq(0);
        });
      });
      when('fee is non zero', () => {
        given(async () => {
          await feesHandler.connect(governor).processFees(defaultSwapperAddress, token.address, amountIn);
        });
        then('feeReceiver gets fee tokens', async () => {
          expect(await token.balanceOf(feeReceiverAddress)).to.be.eq(amountIn.mul(swapperFee).div((await feesHandler.PRECISION()).mul(100)));
        });
      });
    });
  });
});
