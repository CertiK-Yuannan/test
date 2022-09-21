/// NOTE: This is just a helper Script to run Tests. DO NOT RUN in Production.

import { AbiItem } from "web3-utils";
import { CONTRACT_NAME_ERC721_V1, web3Instance } from "./common";
import { nftInfo } from "./nft_info";

async function run() {
    const nftAddress = process.argv[2] as string;   //  CmdLine parameter
    const nftArtifact = require(`../../build/contracts/${CONTRACT_NAME_ERC721_V1}.json`);
    const nftContract = await new web3Instance.eth.Contract(nftArtifact.abi as AbiItem[], nftAddress);
    await nftInfo(nftContract);

}

run();