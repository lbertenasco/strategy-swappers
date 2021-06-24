// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '../contracts/utils/BaseStrategyWithSwapperEnabled.sol';

// Part: ICurveFi

interface ICurveFi {
  function add_liquidity(
    uint256[2] calldata amounts,
    uint256 min_mint_amount,
    bool _use_underlying
  ) external payable returns (uint256);

  function add_liquidity(
    uint256[3] calldata amounts,
    uint256 min_mint_amount,
    bool _use_underlying
  ) external payable returns (uint256);

  function add_liquidity(
    uint256[4] calldata amounts,
    uint256 min_mint_amount,
    bool _use_underlying
  ) external payable returns (uint256);

  function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external payable;

  function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount) external payable;

  function add_liquidity(uint256[4] calldata amounts, uint256 min_mint_amount) external payable;

  // crv.finance: Curve.fi Factory USD Metapool v2
  function add_liquidity(
    address pool,
    uint256[4] calldata amounts,
    uint256 min_mint_amount
  ) external;

  function exchange(
    int128 i,
    int128 j,
    uint256 dx,
    uint256 min_dy
  ) external;

  function exchange_underlying(
    int128 i,
    int128 j,
    uint256 dx,
    uint256 min_dy
  ) external;

  function get_dy(
    int128 i,
    int128 j,
    uint256 dx
  ) external view returns (uint256);

  function balances(int128) external view returns (uint256);

  function get_virtual_price() external view returns (uint256);
}

// Part: IVoterProxy

interface IVoterProxy {
  function withdraw(
    address _gauge,
    address _token,
    uint256 _amount
  ) external returns (uint256);

  function balanceOf(address _gauge) external view returns (uint256);

  function withdrawAll(address _gauge, address _token) external returns (uint256);

  function deposit(address _gauge, address _token) external;

  function harvest(address _gauge) external;

  function lock() external;

  function approveStrategy(address) external;

  function revokeStrategy(address) external;

  function claimRewards(address _gauge, address _token) external;
}

// Part: OpenZeppelin/openzeppelin-contracts@3.1.0/SafeMath

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
  /**
   * @dev Returns the addition of two unsigned integers, reverting on
   * overflow.
   *
   * Counterpart to Solidity's `+` operator.
   *
   * Requirements:
   *
   * - Addition cannot overflow.
   */
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    require(c >= a, 'SafeMath: addition overflow');

    return c;
  }

  /**
   * @dev Returns the subtraction of two unsigned integers, reverting on
   * overflow (when the result is negative).
   *
   * Counterpart to Solidity's `-` operator.
   *
   * Requirements:
   *
   * - Subtraction cannot overflow.
   */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    return sub(a, b, 'SafeMath: subtraction overflow');
  }

  /**
   * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
   * overflow (when the result is negative).
   *
   * Counterpart to Solidity's `-` operator.
   *
   * Requirements:
   *
   * - Subtraction cannot overflow.
   */
  function sub(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    require(b <= a, errorMessage);
    uint256 c = a - b;

    return c;
  }

  /**
   * @dev Returns the multiplication of two unsigned integers, reverting on
   * overflow.
   *
   * Counterpart to Solidity's `*` operator.
   *
   * Requirements:
   *
   * - Multiplication cannot overflow.
   */
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
    if (a == 0) {
      return 0;
    }

    uint256 c = a * b;
    require(c / a == b, 'SafeMath: multiplication overflow');

    return c;
  }

  /**
   * @dev Returns the integer division of two unsigned integers. Reverts on
   * division by zero. The result is rounded towards zero.
   *
   * Counterpart to Solidity's `/` operator. Note: this function uses a
   * `revert` opcode (which leaves remaining gas untouched) while Solidity
   * uses an invalid opcode to revert (consuming all remaining gas).
   *
   * Requirements:
   *
   * - The divisor cannot be zero.
   */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    return div(a, b, 'SafeMath: division by zero');
  }

  /**
   * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
   * division by zero. The result is rounded towards zero.
   *
   * Counterpart to Solidity's `/` operator. Note: this function uses a
   * `revert` opcode (which leaves remaining gas untouched) while Solidity
   * uses an invalid opcode to revert (consuming all remaining gas).
   *
   * Requirements:
   *
   * - The divisor cannot be zero.
   */
  function div(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    require(b > 0, errorMessage);
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold

    return c;
  }

  /**
   * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
   * Reverts when dividing by zero.
   *
   * Counterpart to Solidity's `%` operator. This function uses a `revert`
   * opcode (which leaves remaining gas untouched) while Solidity uses an
   * invalid opcode to revert (consuming all remaining gas).
   *
   * Requirements:
   *
   * - The divisor cannot be zero.
   */
  function mod(uint256 a, uint256 b) internal pure returns (uint256) {
    return mod(a, b, 'SafeMath: modulo by zero');
  }

  /**
   * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
   * Reverts with custom message when dividing by zero.
   *
   * Counterpart to Solidity's `%` operator. This function uses a `revert`
   * opcode (which leaves remaining gas untouched) while Solidity uses an
   * invalid opcode to revert (consuming all remaining gas).
   *
   * Requirements:
   *
   * - The divisor cannot be zero.
   */
  function mod(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    require(b != 0, errorMessage);
    return a % b;
  }
}

// Part: Uni

interface Uni {
  function swapExactTokensForTokens(
    uint256,
    uint256,
    address[] calldata,
    address,
    uint256
  ) external;
}

// Part: CurveVoterProxy

abstract contract CurveVoterProxy is BaseStrategyWithSwapperEnabled {
  using SafeERC20 for IERC20;
  using Address for address;
  using SafeMath for uint256;

  address public constant voter = address(0xF147b8125d2ef93FB6965Db97D6746952a133934);

  address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
  address public constant dai = address(0x6B175474E89094C44Da98b954EedeAC495271d0F);
  address public constant usdc = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
  address public constant usdt = address(0xdAC17F958D2ee523a2206206994597C13D831ec7);
  address public constant weth = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
  address public constant wbtc = address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);

  address public constant uniswap = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
  address public constant sushiswap = address(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

  uint256 public constant DENOMINATOR = 10000;

  address public proxy;
  address public dex;
  address public curve;
  address public gauge;
  uint256 public keepCRV;

  constructor(address _vault, address _tradeFactory) BaseStrategyWithSwapperEnabled(_vault, _tradeFactory) {
    minReportDelay = 6 hours;
    maxReportDelay = 2 days;
    profitFactor = 1000;
    debtThreshold = 1e24;
    proxy = address(0x9a165622a744C20E3B2CB443AeD98110a33a231b);
  }

  function setProxy(address _proxy) external onlyGovernance {
    proxy = _proxy;
  }

  function setKeepCRV(uint256 _keepCRV) external onlyAuthorized {
    keepCRV = _keepCRV;
  }

  function switchDex(bool isUniswap) external onlyAuthorized {
    if (isUniswap) dex = uniswap;
    else dex = sushiswap;
  }

  function name() external view override returns (string memory) {
    return string(abi.encodePacked('Curve', IERC20Metadata(address(want)).symbol(), 'VoterProxy'));
  }

  function balanceOfWant() public view returns (uint256) {
    return want.balanceOf(address(this));
  }

  function balanceOfPool() public view returns (uint256) {
    return IVoterProxy(proxy).balanceOf(gauge);
  }

  function estimatedTotalAssets() public view override returns (uint256) {
    return balanceOfWant().add(balanceOfPool());
  }

  function adjustPosition(uint256 _debtOutstanding) internal override {
    uint256 _want = want.balanceOf(address(this));
    if (_want > 0) {
      want.safeTransfer(proxy, _want);
      IVoterProxy(proxy).deposit(gauge, address(want));
    }
  }

  function _withdrawSome(uint256 _amount) internal returns (uint256) {
    return IVoterProxy(proxy).withdraw(gauge, address(want), _amount);
  }

  function liquidatePosition(uint256 _amountNeeded) internal override returns (uint256 _liquidatedAmount, uint256 _loss) {
    uint256 _balance = want.balanceOf(address(this));
    if (_balance < _amountNeeded) {
      _liquidatedAmount = _withdrawSome(_amountNeeded.sub(_balance));
      _liquidatedAmount = _liquidatedAmount.add(_balance);
      _loss = _amountNeeded.sub(_liquidatedAmount); // this should be 0. o/w there must be an error
    } else {
      _liquidatedAmount = _amountNeeded;
    }
  }

  function prepareMigration(address _newStrategy) internal override {
    IVoterProxy(proxy).withdrawAll(gauge, address(want));
  }

  function _adjustCRV(uint256 _crv) internal returns (uint256) {
    uint256 _keepCRV = _crv.mul(keepCRV).div(DENOMINATOR);
    IERC20(crv).safeTransfer(voter, _keepCRV);
    return _crv.sub(_keepCRV);
  }
}

// File: lusd.sol

contract Strategy is CurveVoterProxy {
  using SafeERC20 for IERC20;
  using Address for address;
  using SafeMath for uint256;

  address public constant pool = address(0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA);
  address public constant lqty = address(0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D);
  address[] public path;
  address[] public pathReward;

  uint256 public slippage;
  uint256 public rewardSlippage;
  uint256 public expiration;
  uint256 public rewardExpiration;

  constructor(address _vault, address _tradeFactory) CurveVoterProxy(_vault, _tradeFactory) {
    dex = sushiswap;
    curve = address(0xA79828DF1850E8a3A3064576f380D90aECDD3359);
    gauge = address(0x9B8519A9a00100720CCdC8a120fBeD319cA47a14);
    keepCRV = 1000;

    path = new address[](3);
    path[0] = crv;
    path[1] = weth;
    _setPath(0, false);
    pathReward = new address[](3);
    pathReward[0] = lqty;
    pathReward[1] = weth;
    _setPath(2, true);
  }

  function ethToWant(uint256 _amtInWei) public view override returns (uint256) {
    // unused, only here to comply with new BaseStrategy API
  }

  function liquidateAllPositions() internal override returns (uint256 _amountFreed) {
    // unused, only here to comply with new BaseStrategy API
  }

  function _setPath(uint256 _id, bool _isReward) internal {
    if (_id == 0) {
      if (_isReward) pathReward[2] = dai;
      else path[2] = dai;
    } else if (_id == 1) {
      if (_isReward) pathReward[2] = usdc;
      else path[2] = usdc;
    } else {
      if (_isReward) pathReward[2] = usdt;
      else path[2] = usdt;
    }
  }

  function setPath(uint256 _id, bool _isReward) external onlyAuthorized {
    _setPath(_id, _isReward);
  }

  function setSlippages(uint256 _slippage, uint256 _rewardSlippage) external onlyAuthorized {
    slippage = _slippage;
    rewardSlippage = _rewardSlippage;
  }

  function setExpirations(uint256 _expiration, uint256 _rewardExpiration) external onlyAuthorized {
    expiration = _expiration;
    rewardExpiration = _rewardExpiration;
  }

  function prepareReturn(uint256 _debtOutstanding)
    internal
    override
    returns (
      uint256 _profit,
      uint256 _loss,
      uint256 _debtPayment
    )
  {
    uint256 before = want.balanceOf(address(this));
    IVoterProxy(proxy).harvest(gauge);
    uint256 _crv = IERC20(crv).balanceOf(address(this)) - _tradeFactoryAllowance(crv);
    if (_crv > 0) {
      _crv = _adjustCRV(_crv);

      /*
            IERC20(crv).safeApprove(dex, 0);
            IERC20(crv).safeApprove(dex, _crv);

            Uni(dex).swapExactTokensForTokens(_crv, uint256(0), path, address(this), block.timestamp);
            */
      _createTrade(
        path[0],
        path[2],
        _crv,
        slippage, /*0.1%*/
        block.timestamp + expiration
      );
    }
    IVoterProxy(proxy).claimRewards(gauge, lqty);
    uint256 _lqty = IERC20(lqty).balanceOf(address(this)) - _tradeFactoryAllowance(lqty);
    if (_lqty > 0) {
      /*
            IERC20(lqty).safeApprove(uniswap, 0);
            IERC20(lqty).safeApprove(uniswap, _lqty);

            Uni(uniswap).swapExactTokensForTokens(_lqty, uint256(0), pathReward, address(this), block.timestamp);
            */
      _createTrade(
        pathReward[0],
        pathReward[2],
        _lqty,
        rewardSlippage, /*0.1%*/
        block.timestamp + rewardExpiration
      );
    }
    uint256 _dai = IERC20(dai).balanceOf(address(this));
    uint256 _usdc = IERC20(usdc).balanceOf(address(this));
    uint256 _usdt = IERC20(usdt).balanceOf(address(this));
    if (_dai > 0 || _usdc > 0 || _usdt > 0) {
      _add_liquidity(_dai, _usdc, _usdt);
    }
    _profit = want.balanceOf(address(this)).sub(before);

    uint256 _total = estimatedTotalAssets();
    uint256 _debt = vault.strategies(address(this)).totalDebt;
    if (_total < _debt) _loss = _debt - _total;

    uint256 _losss;
    if (_debtOutstanding > 0) {
      (_debtPayment, _losss) = liquidatePosition(_debtOutstanding);
    }
    _loss = _loss.add(_losss);
  }

  function _add_liquidity(
    uint256 _dai,
    uint256 _usdc,
    uint256 _usdt
  ) internal {
    if (_dai > 0) {
      IERC20(dai).safeApprove(curve, 0);
      IERC20(dai).safeApprove(curve, _dai);
    }
    if (_usdc > 0) {
      IERC20(usdc).safeApprove(curve, 0);
      IERC20(usdc).safeApprove(curve, _usdc);
    }
    if (_usdt > 0) {
      IERC20(usdt).safeApprove(curve, 0);
      IERC20(usdt).safeApprove(curve, _usdt);
    }
    ICurveFi(curve).add_liquidity(pool, [0, _dai, _usdc, _usdt], 0);
  }

  // NOTE: Can override `tendTrigger` and `harvestTrigger` if necessary

  function protectedTokens() internal view override returns (address[] memory) {
    address[] memory protected = new address[](2);
    protected[0] = crv;
    protected[1] = lqty;
    return protected;
  }
}
