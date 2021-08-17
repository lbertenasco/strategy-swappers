import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { abi as machineryABI } from '@lbertenasco/contract-utils/artifacts/interfaces/utils/IMachinery.sol/IMachinery.json';
import { abi as swapperABI } from '../../../artifacts/contracts/Swapper.sol/ISwapper.json';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '../../utils/bdd';
import { smockit, smoddit, MockContract, ModifiableContractFactory, ModifiableContract } from '@eth-optimism/smock';
import { constants, erc20, evm, wallet, contracts } from '../../utils';
import { BigNumber, utils } from 'ethers';
import moment from 'moment';

contract('TradeFactoryExecutor', () => {
  let governor: SignerWithAddress;
  let strategy: SignerWithAddress;
  let mechanic: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let machinery: MockContract;
  let asyncSwapper: MockContract;
  let syncSwapper: MockContract;
  let executorFactory: ModifiableContractFactory;
  let modifiableExecutor: ModifiableContract;
  let executor: Contract;
  let token: Contract;

  before(async () => {
    [governor, strategy, mechanic, swapperSetter] = await ethers.getSigners();
    executorFactory = await smoddit('contracts/mock/TradeFactory/TradeFactoryExecutor.sol:TradeFactoryExecutorMock', mechanic);
  });

  beforeEach(async () => {
    await evm.reset();
    machinery = await smockit(machineryABI);
    asyncSwapper = await smockit(swapperABI);
    syncSwapper = await smockit(swapperABI);
    modifiableExecutor = await executorFactory.deploy(governor.address, machinery.address);
    executor = modifiableExecutor.connect(mechanic);
    token = await erc20.deploy({
      symbol: 'TK',
      name: 'Token',
      initialAccount: strategy.address,
      initialAmount: utils.parseEther('10000'),
    });
    await executor.connect(governor).grantRole(await executor.STRATEGY(), strategy.address);
    await executor.connect(governor).grantRole(await executor.SWAPPER_SETTER(), swapperSetter.address);
    await executor.connect(governor).addSwappers([asyncSwapper.address, syncSwapper.address]);
    machinery.smocked.isMechanic.will.return.with(true);
    asyncSwapper.smocked.SWAPPER_TYPE.will.return.with(0);
    syncSwapper.smocked.SWAPPER_TYPE.will.return.with(1);
    await executor.connect(governor).setStrategySyncSwapper(strategy.address, syncSwapper.address);
    await executor.connect(governor).setStrategyAsyncSwapper(strategy.address, asyncSwapper.address);
  });

  describe('constructor', () => {});

  describe('execute sync', () => {
    const amountIn = utils.parseEther('100');
    const tokenOut = wallet.generateRandomAddress();
    const maxSlippage = BigNumber.from('1000');
    const data = ethers.utils.defaultAbiCoder.encode([], []);
    // TODO: ONLY STRATEGY
    when('sync swapper thats set was removed', () => {
      given(async () => {
        await executor.connect(governor).removeSwappers([syncSwapper.address]);
      });
      then('tx is reverted with reason', async () => {
        await expect(
          executor.connect(strategy)['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, amountIn, maxSlippage, data)
        ).to.be.revertedWith('TradeFactory: invalid swapper');
      });
    });
    when('token in is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](constants.ZERO_ADDRESS, tokenOut, amountIn, maxSlippage, data)
        ).to.be.revertedWith('TradeFactory: zero address');
      });
    });
    when('token out is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](token.address, constants.ZERO_ADDRESS, amountIn, maxSlippage, data)
        ).to.be.revertedWith('TradeFactory: zero address');
      });
    });
    when('amount in is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, constants.ZERO, maxSlippage, data)
        ).to.be.revertedWith('TradeFactory: zero amount');
      });
    });
    when('max slippage is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor.connect(strategy)['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, amountIn, constants.ZERO, data)
        ).to.be.revertedWith('TradeFactory: zero slippage');
      });
    });
    when('is not the first trade being executed of token in & swapper', async () => {
      let executeTx: TransactionResponse;
      let initialStrategyBalance: BigNumber;
      let initialExecutorBalance: BigNumber;
      const receivedAmount = utils.parseEther('92356');
      given(async () => {
        syncSwapper.smocked.swap.will.return.with(receivedAmount);
        initialStrategyBalance = await token.balanceOf(strategy.address);
        initialExecutorBalance = await token.balanceOf(executor.address);
        await token.connect(strategy).approve(executor.address, amountIn);
        executeTx = await executor
          .connect(strategy)
          ['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, amountIn, maxSlippage, data);
      });
      then('token gets enabled for swapper and token', async () => {
        expect(await token.allowance(executor.address, syncSwapper.address)).to.be.equal(constants.MAX_UINT_256);
      });
      then('funds get taken from strategy', async () => {
        expect(await token.balanceOf(strategy.address)).to.equal(initialStrategyBalance.sub(amountIn));
      });
      then('moves funds from strategy to trade factory', async () => {
        expect(await token.balanceOf(executor.address)).to.equal(initialExecutorBalance.add(amountIn));
      });
      then('calls swapper swap with correct data', () => {
        expect(syncSwapper.smocked.swap.calls[0]).to.be.eql([strategy.address, token.address, tokenOut, amountIn, maxSlippage, data]);
      });
      then('emits event', async () => {
        await expect(executeTx)
          .to.emit(executor, 'SyncTradeExecuted')
          .withArgs(strategy.address, syncSwapper.address, token.address, tokenOut, amountIn, maxSlippage, data, receivedAmount);
      });
    });
  });

  describe('execute async', () => {
    let tradeId: BigNumber;
    const amountIn = utils.parseEther('100');
    const deadline = moment().add('30', 'minutes').unix();
    const tokenOut = wallet.generateRandomAddress();
    const maxSlippage = BigNumber.from('1000');
    const data = contracts.encodeParameters([], []);
    given(async () => {
      ({ id: tradeId } = await create({
        tokenIn: token.address,
        tokenOut,
        amountIn,
        maxSlippage,
        deadline,
      }));
    });
    // TODO: Only mechanic
    when('executing a trade thats not pending', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256,bytes)'](tradeId.add(1), data)).to.be.revertedWith('TradeFactory: trade not pending');
      });
    });
    when('trade has expired', () => {
      given(async () => {
        await evm.advanceToTimeAndBlock(deadline + 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256,bytes)'](tradeId, data)).to.be.revertedWith('TradeFactory: trade has expired');
      });
    });
    when('executing a trade where swapper has been removed', () => {
      given(async () => {
        await executor.connect(governor).removeSwapper(asyncSwapper.address);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256,bytes)'](tradeId, data)).to.be.revertedWith('TradeFactory: invalid swapper');
      });
    });
    when('is not the first trade being executed of token in & swapper', () => {
      let executeTx: TransactionResponse;
      let initialStrategyBalance: BigNumber;
      let initialExecutorBalance: BigNumber;
      const receivedAmount = utils.parseEther('92356');
      given(async () => {
        asyncSwapper.smocked.swap.will.return.with(receivedAmount);
        initialStrategyBalance = await token.balanceOf(strategy.address);
        initialExecutorBalance = await token.balanceOf(executor.address);
        executeTx = await executor['execute(uint256,bytes)'](tradeId, data);
      });
      then('token gets enabled for swapper and token', async () => {
        expect(await token.allowance(executor.address, asyncSwapper.address)).to.be.equal(constants.MAX_UINT_256);
      });
      then('funds get taken from strategy', async () => {
        expect(await token.balanceOf(strategy.address)).to.equal(initialStrategyBalance.sub(amountIn));
      });
      then('moves funds from strategy to trade factory', async () => {
        expect(await token.balanceOf(executor.address)).to.equal(initialExecutorBalance.add(amountIn));
      });
      then('calls swapper swap with correct data', () => {
        expect(asyncSwapper.smocked.swap.calls[0]).to.be.eql([strategy.address, token.address, tokenOut, amountIn, maxSlippage, data]);
      });
      then('removes trades from trades', async () => {
        expect((await executor.pendingTradesById(tradeId))._id).to.equal(0);
      });
      then("removes trades from pending strategy's trade", async () => {
        expect(await executor['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trades from pending trades ids', async () => {
        expect(await executor['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(executeTx).to.emit(executor, 'AsyncTradeExecuted').withArgs(tradeId, receivedAmount);
      });
    });
  });

  describe('expire', () => {
    let tradeId: BigNumber;
    const amountIn = utils.parseEther('100');
    given(async () => {
      ({ id: tradeId } = await create({
        tokenIn: token.address,
        tokenOut: wallet.generateRandomAddress(),
        amountIn,
        maxSlippage: 1000,
        deadline: moment().add('30', 'minutes').unix(),
      }));
    });
    // TODO: Only mechanic
    when('expiring a trade thats not pending', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor.expire(tradeId.add(1))).to.be.revertedWith('TradeFactory: trade not pending');
      });
    });
    when('trade has not expired', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor.expire(tradeId)).to.be.revertedWith('TradeFactory: trade not expired');
      });
    });
    when('trade can be expired', () => {
      let expireTx: TransactionResponse;
      given(async () => {
        await evm.advanceToTimeAndBlock(moment().add('100', 'hours').unix());
        expireTx = await executor.expire(tradeId);
      });
      then('reduces allowance from strategy to trade factory', async () => {
        expect(await token.allowance(strategy.address, executor.address)).to.be.equal(0);
      });
      then('removes trades from trades', async () => {
        expect((await executor.pendingTradesById(tradeId))._id).to.equal(0);
      });
      then("removes trades from pending strategy's trade", async () => {
        expect(await executor['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trades from pending trades ids', async () => {
        expect(await executor['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(expireTx).to.emit(executor, 'AsyncTradeExpired').withArgs(tradeId);
      });
    });
  });

  // describe('enableSwapperToken', () => {
  //   when('called', () => {
  //     let enableSwapperTokenTx: TransactionResponse;
  //     given(async () => {
  //       enableSwapperTokenTx = await executor.enableSwapperToken(asyncSwapper.address, token.address);
  //     });
  //     then('increases allowance of token for swapper to max uint256', async () => {
  //       expect(await token.allowance(executor.address, asyncSwapper.address)).to.be.equal(constants.MAX_UINT_256);
  //     });
  //     then('adds token to the list of approved tokens of swapper', async () => {
  //       expect(await executor.approvedTokensBySwappers(asyncSwapper.address)).to.eql([token.address]);
  //     });
  //     then('emits event', async () => {
  //       await expect(enableSwapperTokenTx).to.emit(executor, 'SwapperAndTokenEnabled').withArgs(asyncSwapper.address, token.address);
  //     });
  //   });
  // });

  async function create({
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippage,
    deadline,
  }: {
    tokenIn: string;
    tokenOut: string;
    amountIn: BigNumber;
    maxSlippage: BigNumber | number;
    deadline: number;
  }): Promise<{ tx: TransactionResponse; id: BigNumber }> {
    await token.connect(strategy).approve(executor.address, amountIn);
    const tx = await executor.connect(strategy).create(tokenIn, tokenOut, amountIn, maxSlippage, deadline);
    const txReceipt = await tx.wait();
    const parsedEvent = executor.interface.parseLog(txReceipt.logs[0]);
    return { tx, id: parsedEvent.args._id };
  }
});
