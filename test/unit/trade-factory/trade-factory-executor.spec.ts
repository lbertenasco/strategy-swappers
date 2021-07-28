import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { abi as tradeFactoryABI } from '../../../artifacts/contracts/TradeFactory/TradeFactory.sol/ITradeFactory.json';
import { abi as machineryABI } from '@lbertenasco/contract-utils/artifacts/interfaces/utils/IMachinery.sol/IMachinery.json';
import { abi as swapperABI } from '../../../artifacts/contracts/Swapper.sol/ISwapper.json';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '../../utils/bdd';
import { smockit, smoddit, MockContract, ModifiableContractFactory } from '@eth-optimism/smock';
import { constants, erc20, evm, wallet, contracts } from '../../utils';
import { BigNumber, utils } from 'ethers';
import moment from 'moment';

contract('TradeFactoryExecutor', () => {
  let governor: SignerWithAddress;
  let strategy: SignerWithAddress;
  let mechanic: SignerWithAddress;
  let tradeFactory: MockContract;
  let machinery: MockContract;
  let swapper: MockContract;
  let executorFactory: ModifiableContractFactory;
  let executor: Contract;
  let token: Contract;

  before(async () => {
    [governor, strategy, mechanic] = await ethers.getSigners();
    executorFactory = await smoddit('contracts/mock/TradeFactory/TradeFactoryExecutor.sol:TradeFactoryExecutorMock', mechanic);
  });

  beforeEach(async () => {
    await evm.reset();
    tradeFactory = await smockit(tradeFactoryABI);
    machinery = await smockit(machineryABI);
    swapper = await smockit(swapperABI);
    executor = await executorFactory.deploy(governor.address, machinery.address);
    executor = executor.connect(mechanic);
    token = await erc20.deploy({
      symbol: 'TK',
      name: 'Token',
      initialAccount: strategy.address,
      initialAmount: utils.parseEther('10000'),
    });
    await executor.connect(governor).grantRole(await executor.STRATEGY(), strategy.address);
    tradeFactory.smocked['isSwapper(address)'].will.return.with(true);
    machinery.smocked.isMechanic.will.return.with(true);
  });

  describe('constructor', () => {});

  describe('execute', () => {
    let tradeId: BigNumber;
    const amountIn = utils.parseEther('100');
    const deadline = moment().add('30', 'minutes').unix();
    const tokenOut = wallet.generateRandomAddress();
    const maxSlippage = BigNumber.from('1000');
    const data = contracts.encodeParameters([], []);
    given(async () => {
      ({ id: tradeId } = await create({
        swapper: 'my-swapper',
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
        await expect(executor.execute(tradeId.add(1), data)).to.be.revertedWith('TradeFactory: trade not pending');
      });
    });
    when('trade has expired', () => {
      given(async () => {
        await evm.advanceToTimeAndBlock(deadline + 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.execute(tradeId, data)).to.be.revertedWith('TradeFactory: trade has expired');
      });
    });
    when('swapper has been deprecated', () => {
      let executeTx: Promise<TransactionResponse>;
      given(async () => {
        executeTx = executor.execute(tradeId, data);
      });
      then('tx is reverted with reason', async () => {
        await expect(executeTx).to.be.revertedWith('TradeFactory: deprecated swapper');
      });
    });
    when('is not the first trade being executed of token in & swapper', () => {
      let executeTx: TransactionResponse;
      let initialStrategyBalance: BigNumber;
      let initialExecutorBalance: BigNumber;
      const receivedAmount = utils.parseEther('92356');
      given(async () => {
        swapper.smocked.swap.will.return.with(receivedAmount);
        initialStrategyBalance = await token.balanceOf(strategy.address);
        initialExecutorBalance = await token.balanceOf(executor.address);
        executeTx = await executor.execute(tradeId, data);
      });
      then('token gets enabled for swapper and token', async () => {
        expect(await token.allowance(executor.address, swapper.address)).to.be.equal(constants.MAX_UINT_256);
      });
      then('moves funds from strategy to trade factory', async () => {
        expect(await token.balanceOf(strategy.address)).to.equal(initialStrategyBalance.sub(amountIn));
        expect(await token.balanceOf(executor.address)).to.equal(initialExecutorBalance.add(amountIn));
      });
      then('calls swapper swap with correct data', () => {
        expect(swapper.smocked.swap.calls[0]).to.be.eql([strategy.address, token.address, tokenOut, amountIn, maxSlippage, data]);
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
        await expect(executeTx).to.emit(executor, 'TradeExecuted').withArgs(tradeId, receivedAmount);
      });
    });
  });

  describe('expire', () => {
    let tradeId: BigNumber;
    const amountIn = utils.parseEther('100');
    given(async () => {
      ({ id: tradeId } = await create({
        swapper: 'my-swapper',
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
        await expect(expireTx).to.emit(executor, 'TradeExpired').withArgs(tradeId);
      });
    });
  });

  describe('enableSwapperToken', () => {
    when('called', () => {
      let enableSwapperTokenTx: TransactionResponse;
      given(async () => {
        enableSwapperTokenTx = await executor.enableSwapperToken(swapper.address, token.address);
      });
      then('increases allowance of token for swapper to max uint256', async () => {
        expect(await token.allowance(executor.address, swapper.address)).to.be.equal(constants.MAX_UINT_256);
      });
      then('adds token to the list of approved tokens of swapper', async () => {
        expect(await executor.approvedTokensBySwappers(swapper.address)).to.eql([token.address]);
      });
      then('emits event', async () => {
        await expect(enableSwapperTokenTx).to.emit(executor, 'SwapperAndTokenEnabled').withArgs(swapper.address, token.address);
      });
    });
  });

  async function create({
    swapper,
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippage,
    deadline,
  }: {
    swapper: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: BigNumber;
    maxSlippage: BigNumber | number;
    deadline: number;
  }): Promise<{ tx: TransactionResponse; id: BigNumber }> {
    await token.connect(strategy).approve(executor.address, amountIn);
    const tx = await executor.connect(strategy).create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, deadline);
    const txReceipt = await tx.wait();
    const parsedEvent = executor.interface.parseLog(txReceipt.logs[0]);
    return { tx, id: parsedEvent.args._id };
  }
});
function encodeParameters(arg0: never[], arg1: never[]) {
  throw new Error('Function not implemented.');
}
