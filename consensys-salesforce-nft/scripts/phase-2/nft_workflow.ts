import { AbiItem, toBN } from 'web3-utils';
import {
    web3Instance,
    CONTRACT_NAME_ERC721_V1,
    CONTRACT_NAME_PAYOUTSPLITTER_V1,
    ROLE_DEPLOYER,
    ROLE_WITHDRAW,
    ROLE_MINTER,
    WALLET_OWNER,
    WALLET_DEPLOYER,
    WALLET_MINTER,
    WALLET_WITHDRAW,
    WALLET_BUYER_1,
    createNftParams,
    ACTUAL_BASE_URI,
    WALLET_BUYER_2,
    WALLET_BUYER_3,
    subTitle,
    title,
    fromWei,
} from "./common";
import { nftInfo } from './nft_info';

async function run() {
    let nftContract;

    const nftAddress = process.argv[2] as string;   //  CmdLine parameter
    if (nftAddress) {
        nftContract = await getContract(nftAddress);
    } else {
        nftContract = await deployNft();
    }

    // General Flow of tasks
    await reserveTokens(nftContract);
    await activateSale(nftContract)
    await mintTokens(nftContract);
    await deactivateSale(nftContract);
    await revealSale(nftContract);
    await withdraw(nftContract);
    await releaseRoyalty(nftContract);

    title("Initial sale completed !")
}

async function getContract(nftAddress: string) {
    const nftArtifact = require(`../../build/contracts/${CONTRACT_NAME_ERC721_V1}.json`);
    const deployedContract = await new web3Instance.eth.Contract(nftArtifact.abi as AbiItem[], nftAddress);

    title(`Contract deployed at ${nftAddress}`);
    await readNft(deployedContract);
    return deployedContract;
}

async function deployNft() {
    const artifact = require(`../../build/contracts/${CONTRACT_NAME_ERC721_V1}.json`);
    const newContract = await new web3Instance.eth.Contract(artifact.abi as AbiItem[]);
    const params = createNftParams();

    const deployedContract = await newContract
        .deploy({
            data: artifact.bytecode,
            arguments: [params]
        })
        .send({ from: WALLET_OWNER, });
    title(`Deploying ${CONTRACT_NAME_ERC721_V1}`);
    console.log("Contract Address:", deployedContract.options.address);

    title("After Deployment")
    await readNft(deployedContract);

    return deployedContract;
}

async function reserveTokens(nftContract: any) {
    await nftContract.methods.reserveTokens(3).send({ from: WALLET_MINTER });
}

async function activateSale(nftContract: any) {
    const isSaleActive = await nftContract.methods.isSaleActive().call();
    if (!isSaleActive) {
        await nftContract.methods.toggleSaleState().send({ from: WALLET_DEPLOYER });
    }
}

async function mintTokens(nftContract: any) {
    const pricePerToken = await nftContract.methods.pricePerToken().call();
    await nftContract.methods.mintTokens(3).send({ from: WALLET_BUYER_1, value: pricePerToken * 3 });
    await nftContract.methods.mintTokens(3).send({ from: WALLET_BUYER_2, value: pricePerToken * 3 });
    await nftContract.methods.mintTokens(1).send({ from: WALLET_BUYER_3, value: pricePerToken * 1 });
}

async function deactivateSale(nftContract: any) {
    const isSaleActive = await nftContract.methods.isSaleActive().call();
    if (isSaleActive) {
        await nftContract.methods.toggleSaleState().send({ from: WALLET_DEPLOYER });
    }

    title("After Sale")
    await readNft(nftContract);
}

async function revealSale(nftContract: any) {
    await nftContract.methods.revealSale(ACTUAL_BASE_URI).send({ from: WALLET_DEPLOYER });

    title("After Reveal")
    await readNft(nftContract);
}

async function withdraw(nftContract: any) {
    title("Withdraw")
    const receipt = await nftContract.methods.withdraw().send({ from: WALLET_WITHDRAW });
    const withdrawEvent = receipt.events.Withdraw.returnValues
    console.log("Event Params");
    console.log("   contractBalance:", fromWei(withdrawEvent.contractBalance));
    console.log("   withdrawAddress:", withdrawEvent.withdrawAddress);
    console.log("   withdrawAmount:", fromWei(withdrawEvent.withdrawAmount));
    console.log("   royaltyAddress:", withdrawEvent.royaltyAddress);
    console.log("   royaltyAmount:", fromWei(withdrawEvent.royaltyAmount));
}

async function releaseRoyalty(nftContract: any) {
    const payoutSplitterAddress = await nftContract.methods.payoutSplittersHistory(0).call();
    const payoutSplitterArtifact = require(`../../build/contracts/${CONTRACT_NAME_PAYOUTSPLITTER_V1}.json`);
    const deployedPayoutContract = await new web3Instance.eth.Contract(payoutSplitterArtifact.abi as AbiItem[], payoutSplitterAddress);
    const payee0 = await deployedPayoutContract.methods.payee(0).call();
    const payee1 = await deployedPayoutContract.methods.payee(1).call();

    await deployedPayoutContract.methods.release(payee0).send({ from: WALLET_DEPLOYER });
    await deployedPayoutContract.methods.release(payee1).send({ from: WALLET_DEPLOYER });

    title("After Withdraw/Royalty Payments")
    await readNft(nftContract);
}

export async function readNft(nftContract: any) {
    await nftInfo(nftContract);
}

run();