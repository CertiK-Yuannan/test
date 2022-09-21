/// NOTE: This is just a helper Script to run Tests. DO NOT RUN in Production.

import Web3 from 'web3';
import HDWalletProvider from '@truffle/hdwallet-provider';
const { soliditySha3 } = require("web3-utils");
require('dotenv').config();

//  ENV Vars
export const NETWORK_ID = process.env.NETWORK_ID as string;
export const RPC_ENDPOINT = process.env.RPC_ENDPOINT as string;
export const INFURA_KEY = process.env.INFURA_KEY as string;
export const MNEMONIC = process.env.MENMONIC as string;

export const hdWalletProvider = getHDWalletProvider();
export const web3Instance = new Web3(hdWalletProvider);

export const WALLET_OWNER = hdWalletProvider.getAddress(0);
export const WALLET_DEFAULT_ADMIN = hdWalletProvider.getAddress(1);
export const WALLET_DEPLOYER = hdWalletProvider.getAddress(2);
export const WALLET_MINTER = hdWalletProvider.getAddress(3);
export const WALLET_WITHDRAW = hdWalletProvider.getAddress(4);
export const WALLET_BUYER_1 = hdWalletProvider.getAddress(5);
export const WALLET_BUYER_2 = hdWalletProvider.getAddress(6);
export const WALLET_BUYER_3 = hdWalletProvider.getAddress(7);
export const WALLET_PAYEE1 = hdWalletProvider.getAddress(8);
export const WALLET_PAYEE2 = hdWalletProvider.getAddress(9);

export const ROLE_DEFAULT_ADMIN = soliditySha3("DEFAULT_ADMIN_ROLE");
export const ROLE_DEPLOYER = soliditySha3("DEPLOYER_ROLE");
export const ROLE_MINTER = soliditySha3("MINTER_ROLE");
export const ROLE_WITHDRAW = soliditySha3("WITHDRAW_ROLE");

export const CONTRACT_NAME_ERC721_V1 = "Erc721V1";
export const CONTRACT_NAME_PAYOUTSPLITTER_V1 = "PayoutSplitterV1";

export const STATIC_BASE_URI = "https://ipfs.io/ipfs/QmSJkcD87AVqpDmw2DVLRHggZFYAuU3XgSfFpQu8tQDs4Q/generic_ape";
export const ACTUAL_BASE_URI = "https://ipfs.io/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/";
export const CONTRACT_URI = "https://ipfs.io/ipfs/QmSTKWm27eJNgLpmJkV45SCdszAiJ7bw4UMmWQGd6s7LiQ/contract-uri.json";

export function toBN(value: string | number) {
    return web3Instance.utils.toBN(value);
}

export function createNftParams() {
    return {
        name: "Authentic Amazing Apes",
        symbol: "AAA",
        baseURI: STATIC_BASE_URI,
        contractURI: CONTRACT_URI,
        provenance: "5a666ec89633ae930e01147b6b605a37779019bd36019c2ea8314d5ac661c4a6",
        totalRoyalty: 2500, // 25%
        pricePerToken: web3Instance.utils.toWei("0.001"),
        maxSupply: 10,
        maxTokensPerWallet: 5,
        maxTokensPerTxn: 3,
        isRevealed: false,
        roles: [
            ROLE_DEPLOYER,
            ROLE_MINTER,
            ROLE_WITHDRAW,
        ],
        roleAddresses: [
            WALLET_DEPLOYER,
            WALLET_MINTER,
            WALLET_WITHDRAW
        ],
        payees: [
            WALLET_PAYEE1,
            WALLET_PAYEE2
        ],
        shares: [7500, 2500]    // 75%, 25%
    };
}

export function getHDWalletProvider(): HDWalletProvider {
    let rpcEndpoint = RPC_ENDPOINT;
    if (NETWORK_ID == "4") {
        rpcEndpoint = `${RPC_ENDPOINT}${INFURA_KEY}`;
    }
    return new HDWalletProvider(MNEMONIC, rpcEndpoint);
}

export function fromWei(amount: any) {
    return `${web3Instance.utils.fromWei(amount)} ether`;
}

export function subTitle(title: string) {
    console.log(`${"-".repeat(5)} ${title}`);
}

export function title(title: string) {
    newLine();
    console.log(`${"*".repeat(5)} ${title} ${"*".repeat(75 - title?.length)}`);
}

export function newLine() {
    console.log("\n");
}
