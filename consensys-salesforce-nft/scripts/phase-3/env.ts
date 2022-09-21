require("dotenv").config();

//  ENV Vars
export const CHAIN_ID = process.env.CHAIN_ID as string;
export const RPC_ENDPOINT = process.env.RPC_ENDPOINT as string;
export const INFURA_KEY = process.env.INFURA_KEY as string;
export const MNEMONIC = process.env.MENMONIC as string;
