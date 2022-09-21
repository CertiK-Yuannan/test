module.exports = {
    accounts: {
        amount: 20, // Number of unlocked accounts
        ether: 1000, // Initial balance of unlocked accounts (in ether)
    },

    contracts: {
        defaultGas: 7e6, // Maximum gas for contract calls (when unspecified)
        defaultGasPrice: 20e9, // Gas price for contract calls (when unspecified)
    },

    node: { // Options passed directly to Ganache client
        gasLimit: 8e6, // Maximum gas per block
        gasPrice: 20e9 // Sets the default gas price for transactions if not otherwise specified.
    },
};