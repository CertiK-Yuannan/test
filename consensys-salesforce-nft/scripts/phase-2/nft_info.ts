/// NOTE: This is just a helper Script to run Tests. DO NOT RUN in Production.

import { AbiItem } from "web3-utils";
import {
    fromWei,
    web3Instance,
    subTitle,
    CONTRACT_NAME_PAYOUTSPLITTER_V1,
    ROLE_DEPLOYER,
    ROLE_MINTER,
    ROLE_WITHDRAW,
    WALLET_DEPLOYER,
    WALLET_MINTER,
    WALLET_WITHDRAW,
    WALLET_BUYER_1,
    WALLET_BUYER_2,
    WALLET_BUYER_3,
} from "./common";

export async function nftInfo(nftContract: any) {
    console.log("Name :", await nftContract.methods.name().call());
    console.log("Symbol :", await nftContract.methods.symbol().call());
    console.log("BaseURI :", await nftContract.methods.baseURI().call());
    console.log("ContractURI :", await nftContract.methods.contractURI().call());
    console.log("Provenance :", await nftContract.methods.provenance().call());
    console.log("PricePerToken :", fromWei(await nftContract.methods.pricePerToken().call()));
    console.log("MaxTokensPerWallet :", await nftContract.methods.maxTokensPerWallet().call());
    console.log("MaxTokenPerTxn :", await nftContract.methods.maxTokensPerTxn().call());
    console.log("IsSaleActive :", await nftContract.methods.isSaleActive().call());
    console.log("IsRevealed :", await nftContract.methods.isRevealed().call());
    console.log("MaxSupply :", await nftContract.methods.maxSupply().call());
    const totalSupply = await nftContract.methods.totalSupply().call();

    console.log("TotalSupply :", totalSupply);
    console.log("offsetIndexBlock :", await nftContract.methods.offsetIndexBlock().call());
    console.log("OffsetIndex :", await nftContract.methods.offsetIndex().call());
    for (let i = 0; i < totalSupply; i++) {
        console.log(`TokenURI (${i}) :`, await nftContract.methods.tokenURI(i).call());
    }

    console.log("TokensOwned (Minter) :", await nftContract.methods.balanceOf(WALLET_MINTER).call());
    console.log("TokensOwned (Buyer1) :", await nftContract.methods.balanceOf(WALLET_BUYER_1).call());
    console.log("TokensOwned (Buyer2) :", await nftContract.methods.balanceOf(WALLET_BUYER_2).call());
    console.log("TokensOwned (Buyer3) :", await nftContract.methods.balanceOf(WALLET_BUYER_3).call());

    subTitle("Roles/Accounts");
    console.log(`DEPLOYER_ROLE/${WALLET_DEPLOYER} :`, await nftContract.methods.hasRole(ROLE_DEPLOYER, WALLET_DEPLOYER).call());
    console.log(`MINTER_ROLE/${WALLET_MINTER} :`, await nftContract.methods.hasRole(ROLE_MINTER, WALLET_MINTER).call());
    console.log(`WITHDRAW_ROLE/${WALLET_WITHDRAW} :`, await nftContract.methods.hasRole(ROLE_WITHDRAW, WALLET_WITHDRAW).call());

    subTitle("PayoutSplitter/Royalties");
    const payoutSplitterAddress = await nftContract.methods.payoutSplittersHistory(0).call();
    const payoutSplitterArtifact = require(`../build/contracts/${CONTRACT_NAME_PAYOUTSPLITTER_V1}.json`);
    const deployedPayoutContract = await new web3Instance.eth.Contract(payoutSplitterArtifact.abi as AbiItem[], payoutSplitterAddress);
    const payoutSplitterBalance = fromWei(await web3Instance.eth.getBalance(payoutSplitterAddress));
    const payee0 = await deployedPayoutContract.methods.payee(0).call();
    const share0 = await deployedPayoutContract.methods.shares(payee0).call();
    const releasded0 = fromWei(await deployedPayoutContract.methods.released(payee0).call());

    const payee1 = await deployedPayoutContract.methods.payee(1).call();
    const share1 = await deployedPayoutContract.methods.shares(payee1).call();
    const releasded1 = fromWei(await deployedPayoutContract.methods.released(payee1).call());

    console.log("Contract Balance :", fromWei(await web3Instance.eth.getBalance(nftContract.options.address)));
    console.log("PayoutSplittersHistory [0] :", payoutSplitterAddress);
    console.log("PayoutSplitters [0] Balance:", payoutSplitterBalance);
    console.log("Payee [0] :", payee0);
    console.log("Share [0] :", share0);
    console.log("Released to [0] :", releasded0);
    console.log("Payee [1] :", payee1);
    console.log("Share [1] :", share1);
    console.log("Released to [1] :", releasded1);    
}