const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT;
const INFURA_KEY = process.env.INFURA_KEY;
const MNEMONIC = process.env.MENMONIC;

module.exports = {

  networks: {
    local: {
      provider: () => new HDWalletProvider(MNEMONIC, RPC_ENDPOINT),
      network_id: "5777"
    },
    rinkeby: {
      provider: () => new HDWalletProvider(MNEMONIC, `${RPC_ENDPOINT}${INFURA_KEY}`),
      gas: 5000000,
      network_id: process.env.NETWORK_ID,
      skipDryRun: true
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },
  
  // Truffle is used to test Phase-2 Contracts only.
  //  For Phase-3 Contracts, we migrated to Jest for speed and typescript support. Running `npm test` will use Jest.
  test_directory: 'scripts/phase-2/test',

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.14",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        optimizer: {
          enabled: true,
          runs: 75
        },
        //  evmVersion: "byzantium"
      }
    }
  },
  plugins: [
    'truffle-plugin-verify',
    'truffle-contract-size',
    "solidity-coverage"
  ],
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  }
};