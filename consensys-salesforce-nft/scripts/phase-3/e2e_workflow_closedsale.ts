import { ethers } from "ethers";
import {
  Account,
  CONTRACT_ADMIN_ROLE,
  getAccounts,
  getSigner,
  IDX_BUYER_1,
  IDX_BUYER_2,
  IDX_BUYER_3,
  IDX_CONTRACT_ADMIN_1,
  IDX_CONTRACT_ADMIN_2,
  IDX_CONTRACT_ADMIN_3,
  IDX_CONTRACT_ADMIN_4,
  IDX_FINANCE_ADMIN_1,
  IDX_FINANCE_ADMIN_2,
  IDX_PAYEE_1,
  IDX_PAYEE_2,
  IDX_RANDOM_1,
  IDX_VOUCHER_SIGNER_1,
} from "./accounts";
import {
  ERC721_CS_V2,
  ethersProvider,
  getArtifact,
  getEventNames,
  nonceGen,
  OpenSaleParams,
  PAYMENT_SPLITTER,
} from "./common";
import { CHAIN_ID } from "./env";
import { createMultiSigParam } from "./payload_multisig/common";
import { createPayload as createPauseTokensPayload } from "./payload_multisig/pause_tokens";
import { createPayload as createRevealSalePayload } from "./payload_multisig/reveal_sale";
import { createPayload as createTogglePausePayload } from "./payload_multisig/toggle_pause";
import { createPayload as createToggleSalePayload } from "./payload_multisig/toggle_sale";
import { createPayload as createRoleRoyaltyPayoutPayload } from "./payload_multisig/update_role_royalty_pricepayout";
import { createPayload as createWithdrawPayload } from "./payload_multisig/withdraw";
import { createClosedSaleParams, multiSigRoleThreshold } from "./erc721_params";
import {
  createPayload as createMintTokensPayload,
  createVoucherParam as createMintTokensVoucherParam,
} from "./payload_voucher/mint_tokens";

let contractName = ERC721_CS_V2;
let network: ethers.providers.Network;
let chainId: number;
let nonce: number;
let erc721Address: string;
let artifact: any;
let accounts: Account[];
let params: OpenSaleParams;
let erc721Contract: ethers.Contract;
let contractAdminContract: ethers.Contract;
let financeAdminContract: ethers.Contract;
let buyerContract: ethers.Contract;
let contractAdminSigners: number[];
let financeAdminSigners: number[];
let defaultSigner: ethers.Wallet;
let financeAdminSigner: ethers.Wallet;
let buyer1Signer: ethers.Wallet;

export async function run() {
  // General Flow of tasks
  await deployNft();
  await readErc721();
  await updateRoleRoyaltyPricePayout();
  await activateSale();
  await pauseContract();
  await resumeContract();
  await mintTokens();
  await readErc721();
  await pauseTokens();
  await resumeTokens();
  await markNonceAsUsed();
  await deactivateSale();
  await revealSale();
  await withdraw();
  await readErc721();
  await releaseRoyalty();
  await readErc721();
  console.log(`\n${contractName} Initial sale completed !`);
}

async function deployNft() {
  console.log(`\nDeploying ${contractName} ...`);

  // Initialize variables
  network = await ethersProvider.getNetwork();
  chainId = network.chainId;

  artifact = getArtifact(contractName);
  accounts = getAccounts();
  params = createClosedSaleParams(accounts, multiSigRoleThreshold());
  defaultSigner = getSigner(IDX_CONTRACT_ADMIN_1, ethersProvider);
  financeAdminSigner = getSigner(IDX_FINANCE_ADMIN_1, ethersProvider);
  buyer1Signer = getSigner(IDX_BUYER_1, ethersProvider);

  contractAdminSigners = [IDX_CONTRACT_ADMIN_1, IDX_CONTRACT_ADMIN_2, IDX_CONTRACT_ADMIN_3];
  financeAdminSigners = [IDX_FINANCE_ADMIN_1, IDX_FINANCE_ADMIN_2];

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, defaultSigner);
  erc721Contract = await factory.deploy(params);
  const receipt = await erc721Contract.deployTransaction.wait();
  erc721Address = erc721Contract.address;

  contractAdminContract = erc721Contract.connect(defaultSigner);
  financeAdminContract = erc721Contract.connect(financeAdminSigner);
  buyerContract = erc721Contract.connect(buyer1Signer);

  console.dir(
    {
      networkId: CHAIN_ID,
      deployer: defaultSigner.address,
      contract: contractName,
      address: erc721Contract.address,
      // events: getEventNames(receipt),
    },
    { depth: null }
  );
}

async function updateRoleRoyaltyPricePayout() {
  console.log(`\nUpdating Roles, Royalties, PricePayoutWallet ...`);

  nonce = nonceGen();
  const grantRoles = [CONTRACT_ADMIN_ROLE];
  const grantRoleAddresses = [accounts[IDX_CONTRACT_ADMIN_4].address];
  const revokeRoles = [CONTRACT_ADMIN_ROLE] as string[];
  const revokeRoleAddresses = [accounts[IDX_CONTRACT_ADMIN_4].address] as string[];
  const totalRoyalty = 1000;
  const payees = [accounts[IDX_PAYEE_1].address, accounts[IDX_PAYEE_2].address];
  const shares = [6000, 4000];
  const pricePayoutWallets = [accounts[IDX_RANDOM_1].address];

  const payload = createRoleRoyaltyPayoutPayload(
    erc721Address,
    chainId,
    nonce,
    grantRoles,
    grantRoleAddresses,
    revokeRoles,
    revokeRoleAddresses,
    totalRoyalty,
    payees,
    shares,
    pricePayoutWallets
  );
  const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);

  const txn = await contractAdminContract.updateRoleRoyaltyPayout(
    grantRoles,
    grantRoleAddresses,
    revokeRoles,
    revokeRoleAddresses,
    totalRoyalty,
    payees,
    shares,
    pricePayoutWallets,
    multiSigParam
  );
  const receipt = await txn.wait();
  console.log("Result", getEventNames(receipt));
}

async function activateSale() {
  console.log(`\nActivating sale ...`);

  nonce = nonceGen();
  const payload = createToggleSalePayload(erc721Address, chainId, nonce);
  const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
  const txn = await contractAdminContract.toggleSaleState(multiSigParam);
  const receipt = await txn.wait();
  console.log("Result", getEventNames(receipt));
}

async function pauseContract() {
  console.log(`\nPausing contract ...`);

  nonce = nonceGen();
  const payload = createTogglePausePayload(erc721Address, chainId, nonce);
  const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
  const txn = await contractAdminContract.togglePauseState(multiSigParam);
  const receipt = await txn.wait();
  console.log("Result", getEventNames(receipt));
}

async function resumeContract() {
  console.log(`\nResuming contract ...`);

  nonce = nonceGen();
  const payload = createTogglePausePayload(erc721Address, chainId, nonce);
  const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
  const txn = await contractAdminContract.togglePauseState(multiSigParam);
  const receipt = await txn.wait();
  console.log("Result", getEventNames(receipt));
}

async function mintTokens() {
  console.log(`\nMinting tokenIds 0,1,2 ...`);

  const nonce = nonceGen();
  const tokenCount = 3;
  const buyer = accounts[IDX_BUYER_1].address;
  const now_Minus_1Hr = new Date(Date.now());
  now_Minus_1Hr.setHours(-1);
  const issueTime = Math.floor(now_Minus_1Hr.valueOf() / 1000); // NowMinus1Hr in seconds,
  const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
  const pricePerToken = ethers.utils.parseEther("0.001");
  const value = ethers.utils.parseEther("0.001").mul(tokenCount);

  const payload = createMintTokensPayload(
    erc721Address,
    chainId,
    nonce,
    buyer,
    issueTime,
    expirationDuration,
    pricePerToken.toString()
  );
  const voucherParam = await createMintTokensVoucherParam(
    payload,
    nonce,
    IDX_VOUCHER_SIGNER_1,
    buyer,
    issueTime,
    expirationDuration,
    pricePerToken.toString()
  );
  const txn = await buyerContract.mintTokens(tokenCount, voucherParam, { value });
  await txn.wait();
  const balance = await ethersProvider.getBalance(erc721Address);
  console.log("Result - Contract Balance: ETH:", balance.toString());
  console.log("TokenURI(0)", await contractAdminContract.tokenURI(0));
  console.log("TokenURI(1)", await contractAdminContract.tokenURI(1));
  console.log("TokenURI(2)", await contractAdminContract.tokenURI(2));
}

async function pauseTokens() {
  console.log(`\nPausing tokens ...`);

  nonce = nonceGen();
  const tokenIds = [0, 1];
  const pause = true;
  const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
  const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
  const txn = await contractAdminContract.pauseTokens(tokenIds, pause, multiSigParam);
  const receipt = await txn.wait();
  console.log("Result", getEventNames(receipt));
}

async function resumeTokens() {
  console.log(`\nResuming tokens ...`);

  nonce = nonceGen();
  const tokenIds = [0, 1];
  const pause = false;
  const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
  const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
  const txn = await contractAdminContract.pauseTokens(tokenIds, pause, multiSigParam);
  const receipt = await txn.wait();
  console.log("Result", getEventNames(receipt));
}

async function markNonceAsUsed() {
  console.log(`\nMarking nonce as used ...`);

  const nonceToPause = 1;
  const txn = await contractAdminContract.markMultisigNonceUsed(nonceToPause);
  const receipt = await txn.wait();
  console.log("Result - Done");
}

async function deactivateSale() {
  console.log(`\nDeactivating sale ...`);

  nonce = nonceGen();
  const payload = createToggleSalePayload(erc721Address, chainId, nonce);
  const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
  const txn = await contractAdminContract.toggleSaleState(multiSigParam);
  const receipt = await txn.wait();
  console.log("Result", getEventNames(receipt));
}

async function revealSale() {
  console.log(`\nRevealing sale ...`);

  nonce = nonceGen();
  const baseURI = "https://some-new-baseURI/";
  const payload = createRevealSalePayload(erc721Address, chainId, nonce, baseURI);
  const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
  const txn = await contractAdminContract.revealSale(baseURI, multiSigParam);
  const receipt = await txn.wait();
  console.log("Result", getEventNames(receipt));
  console.log("OffsetIndex", (await contractAdminContract.offsetIndex()).toNumber());
  console.log("TokenURI(0)", await contractAdminContract.tokenURI(0));
  console.log("TokenURI(1)", await contractAdminContract.tokenURI(1));
  console.log("TokenURI(2)", await contractAdminContract.tokenURI(2));
}

async function withdraw() {
  console.log(`\nWithdrawing funds ...`);

  nonce = nonceGen();
  const payload = createWithdrawPayload(erc721Address, chainId, nonce);
  const multiSigParam = await createMultiSigParam(payload, nonce, financeAdminSigners);
  const txn = await financeAdminContract.withdraw(multiSigParam);
  const receipt = await txn.wait();
  const balance = await ethersProvider.getBalance(erc721Address);
  console.log("Result - Contract Balance: ETH", balance.toString());
}

async function releaseRoyalty() {
  console.log(`\nReleasing royalties to payees ...`);

  const psArtifact = getArtifact(PAYMENT_SPLITTER);
  const paymentSplitter = await erc721Contract.currentPaymentSplitter();

  let paymentSplitterContract = new ethers.Contract(
    paymentSplitter,
    psArtifact.abi,
    getSigner(IDX_PAYEE_1, ethersProvider)
  );

  let balance = await paymentSplitterContract.shares(accounts[IDX_PAYEE_1].address);
  let txn = await paymentSplitterContract["release(address)"](accounts[IDX_PAYEE_1].address);
  let receipt = await txn.wait();
  console.log("Result: ETH", balance.toString(), getEventNames(receipt));

  balance = await paymentSplitterContract.shares(accounts[IDX_PAYEE_2].address);
  paymentSplitterContract = new ethers.Contract(
    paymentSplitter,
    psArtifact.abi,
    getSigner(IDX_PAYEE_2, ethersProvider)
  );
  txn = await paymentSplitterContract["release(address)"](accounts[IDX_PAYEE_2].address);
  receipt = await txn.wait();
  console.log("Result: ETH", balance.toString(), getEventNames(receipt));
}

async function readErc721() {
  console.log(`\n ********** ${contractName} Info ********** :`);
  console.log("Name :", await erc721Contract.name());
  console.log("Symbol :", await erc721Contract.symbol());
  console.log("BaseURI :", await erc721Contract.baseURI());
  console.log("ContractURI :", await erc721Contract.contractURI());
  console.log("Provenance :", await erc721Contract.provenance());
  console.log("MaxTokensPerWallet :", (await erc721Contract.maxTokensPerWallet()).toNumber());
  const ppWallet = await erc721Contract.pricePayoutWallet();
  console.log("PricePayoutWallet :", ppWallet);
  console.log("MaxTokenPerTxn :", (await erc721Contract.maxTokensPerTxn()).toNumber());
  console.log("IsSaleActive :", await erc721Contract.isSaleActive());
  console.log("IsRevealed :", await erc721Contract.isRevealed());
  console.log("MaxSupply :", (await erc721Contract.maxSupply()).toNumber());
  const totalSupply = (await erc721Contract.totalSupply()).toNumber();

  console.log("TotalSupply :", totalSupply);

  console.log("offsetIndexBlock :", (await erc721Contract.offsetIndexBlock()).toNumber());
  console.log("OffsetIndex :", (await erc721Contract.offsetIndex()).toNumber());
  for (let i = 0; i < totalSupply; i++) {
    console.log(`TokenURI (${i}) :`, await erc721Contract.tokenURI(i));
  }

  console.log(
    "TokensOwned (ContractAdmin) :",
    (await erc721Contract.balanceOf(accounts[IDX_CONTRACT_ADMIN_1].address)).toNumber()
  );
  console.log("TokensOwned (Buyer1) :", (await erc721Contract.balanceOf(accounts[IDX_BUYER_1].address)).toNumber());
  console.log("TokensOwned (Buyer2) :", (await erc721Contract.balanceOf(accounts[IDX_BUYER_2].address)).toNumber());
  console.log("TokensOwned (Buyer3) :", (await erc721Contract.balanceOf(accounts[IDX_BUYER_3].address)).toNumber());

  console.log("\nPaymentSplitter/Royalties");
  const paymentSplitterAddress = await erc721Contract.currentPaymentSplitter();
  const paymentSplitterArtifact = getArtifact(PAYMENT_SPLITTER);
  const deployedPaymentContract = await new ethers.Contract(
    paymentSplitterAddress,
    paymentSplitterArtifact.abi,
    ethersProvider
  );
  const paymentSplitterBalance = await ethersProvider.getBalance(paymentSplitterAddress);
  const payee0 = await deployedPaymentContract.payee(0);
  const share0 = await deployedPaymentContract.shares(payee0);
  const releasded0 = await deployedPaymentContract["released(address)"](payee0);

  const payee1 = await deployedPaymentContract.payee(1);
  const share1 = await deployedPaymentContract.shares(payee1);
  const releasded1 = await deployedPaymentContract["released(address)"](payee1);

  console.log("Contract Balance :", (await ethersProvider.getBalance(erc721Contract.address)).toString());
  console.log("PricePayout Balance :", (await ethersProvider.getBalance(ppWallet)).toString());
  console.log("CurrentPaymentSplitter :", paymentSplitterAddress);
  console.log("PaymentSplitter Balance:", paymentSplitterBalance.toNumber());
  console.log("Payee [0] :", payee0);
  console.log("Share [0] :", share0.toNumber());
  console.log("Released to [0] :", releasded0.toString());
  console.log("Payee [1] :", payee1);
  console.log("Share [1] :", share1.toNumber());
  console.log("Released to [1] :", releasded1.toString());
}

run().then((_) => process.exit(0));
