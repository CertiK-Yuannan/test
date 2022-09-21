const { soliditySha3 } = require("web3-utils");

function createParams(accounts, overrideWith) {
    params = {
        name: "Test Collection",
        symbol: "TC",
        baseURI: "http://ipfs.io/ipfs/static-base-uri",
        contractURI: "http://ipfs.io/ipfs/contract-uri",
        provenance: "cc354b3fcacee8844dcc9861004da081f71df9567775b3f3a43412752752c0bf",
        totalRoyalty: 2500, // 25%
        pricePerToken: web3.utils.toWei("0.08"),
        maxSupply: 10,
        maxTokensPerWallet: 5,
        maxTokensPerTxn: 3,
        isRevealed: false,
        roles: [
            soliditySha3("DEPLOYER_ROLE"),
            soliditySha3("MINTER_ROLE"),
            soliditySha3("WITHDRAW_ROLE"),
        ],
        roleAddresses: [
            accounts[2],
            accounts[3],
            accounts[4],
        ],
        payees: [
            accounts[7],
            accounts[8],
        ],
        shares: [7500, 2500]    // 75%, 25%
    }
    return { ...params, ...(overrideWith || {}) };
}

module.exports = {
    createParams
};