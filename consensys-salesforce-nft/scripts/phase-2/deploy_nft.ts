/// NOTE: This is just a helper Script to run Tests. DO NOT RUN in Production.

import { AbiItem } from 'web3-utils';
import {
    web3Instance,
    WALLET_OWNER,
    CONTRACT_NAME_ERC721_V1,
    createNftParams,
} from "./common";

async function run() {
    const artifact = require(`../../build/contracts/${CONTRACT_NAME_ERC721_V1}.json`);
    const newContract = await new web3Instance.eth.Contract(artifact.abi as AbiItem[]);
    const params = createNftParams();

    const deployedContract = await newContract
        .deploy({
            data: artifact.bytecode,
            arguments: [params]
        })
        .send({ from: WALLET_OWNER, });
    console.log(`${CONTRACT_NAME_ERC721_V1} Address :`, deployedContract.options.address);
}

run();