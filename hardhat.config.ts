import 'dotenv/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import { removeConsoleLog } from 'hardhat-preprocessor';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import 'hardhat-deploy';
import { HardhatUserConfig, NetworksUserConfig } from 'hardhat/types';
import { getNodeUrl } from './utils/network';
import { utils } from 'ethers';

const networks: NetworksUserConfig = process.env.TEST
  ? {}
  : {
      hardhat: {
        forking: {
          enabled: process.env.FORK ? true : false,
          url: getNodeUrl('mainnet'),
        },
        // accounts: [{ privateKey: process.env.POLYGON_PRIVATE_KEY as string, balance: utils.parseEther('1000000').toString() }],
      },
      localhost: {
        url: getNodeUrl('localhost'),
        live: false,
        // accounts: [process.env.LOCAL_MAINNET_PRIVATE_KEY as string],
        tags: ['local'],
      },
      mainnet: {
        url: getNodeUrl('mainnet'),
        accounts: [process.env.MAINNET_PRIVATE_KEY as string],
        gasPrice: 'auto',
        tags: ['production'],
      },
      polygon: {
        url: getNodeUrl('polygon'),
        accounts: [process.env.POLYGON_PRIVATE_KEY as string],
        tags: ['production'],
      },
    };

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  namedAccounts: {
    deployer: 0, // yMECH Alejo
    governor: 0, // yMECH Alejo
    // yMech: 0, // yMECH Alejo
    // deployer: '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', // yMECH Alejo
    // governor: '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', // yMECH Alejo
    yMech: '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', // yMECH Alejo
  },
  networks,
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
    ],
  },
  gasReporter: {
    currency: process.env.COINMARKETCAP_DEFAULT_CURRENCY || 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    enabled: process.env.REPORT_GAS ? true : false,
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat'),
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
