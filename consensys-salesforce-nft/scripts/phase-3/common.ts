import { ethers } from "ethers";
import { MNEMONIC, RPC_ENDPOINT, CHAIN_ID, INFURA_KEY } from "./env";

export const GANACHE_CHAIN_ID = 1337;
export const hdNode = getHDNode();
export const ethersProvider = getEthersProvider();

export const ERC721_SALE = "Erc721SaleV2";
export const ERC721_SALE_TEST = "Erc721SaleTest";
export const ERC721_CS_V2 = "Erc721ClosedSaleV2";
export const ERC721_CSE_V2 = "Erc721ClosedSaleExtendedV2";
export const ERC721_OS_V2 = "Erc721OpenSaleV2";
export const ERC721_OSE_V2 = "Erc721OpenSaleExtendedV2";
export const PAYMENT_SPLITTER = "PaymentSplitter";

//  ERC165 InterfaceIds
export const IERC2981 = "0x2a55205a";
export const IERC721 = "0x80ac58cd";
export const IERC721Metadata = "0x5b5e139f";

export interface SaleParams {
  name: string;
  symbol: string;
  baseURI: string;
  contractURI: string;
  totalRoyalty: number;
  maxSupply: number;
  maxTokensPerWallet: number;
  pricePayoutWallet: string;
  roles: string[];
  roleAddresses: string[];
  multisigRoles: string[];
  multisigThresholds: number[];
  payees: string[];
  shares: number[];
}

export interface ClosedSaleParams extends SaleParams {
  provenance: string;
  maxTokensPerTxn: number;
}

export interface OpenSaleParams extends SaleParams {}

export interface SignedDataV4Type {
  name: string;
  type: string;
}

export interface SignedDataV4 {
  types: { [typeName: string]: SignedDataV4Type[] };
  primaryType?: string;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  message?: any;
}

export enum SaleType {
  OPEN_SALE = "OS",
  CLOSED_SALE = "CS",
}

export enum PayloadType {
  VOUCHER = "Voucher",
  MULTISIG = "MultiSig",
}

export const nonceGen = autoGen();

function getHDNode() {
  const hdNode = ethers.utils.HDNode.fromMnemonic(MNEMONIC);
  return hdNode;
}

export function getEthersProvider() {
  let rpcEndpoint = RPC_ENDPOINT;
  if (+CHAIN_ID != GANACHE_CHAIN_ID) {
    rpcEndpoint = `${RPC_ENDPOINT}${INFURA_KEY}`;
  }
  return new ethers.providers.JsonRpcProvider(rpcEndpoint);
}

export function getArtifact(artifactName: string) {
  const artifactPath = `${process.cwd()}\\build\\contracts\\${artifactName}.json`;
  const artifact = require(artifactPath);
  return artifact;
}

export function getEventNames(receipt: ethers.providers.TransactionReceipt): string[] {
  const eventInfo = getEventInfo(receipt);
  return eventInfo.map((ei: any) => ei.event);
}

export function getEventInfo(receipt: ethers.providers.TransactionReceipt): { event: string; args: any[] }[] {
  const events: [] = (receipt as any)["events"];
  const eventInfo = events
    .filter((e: any) => e.event != undefined)
    .map((e: any) => ({
      event: e.event,
      args: e.args,
    }));
  return eventInfo;
}

export function parseEvent(eventName: string, args: any[]) {
  switch (eventName) {
    case "OwnershipTransferred":
      return {
        eventName,
        args: {
          previousOwner: args[0],
          newOwner: args[1],
        },
      };

    case "RoleGranted":
      return {
        eventName,
        args: {
          role: args[0],
          account: args[1],
          sender: args[2],
        },
      };

    case "PaymentSplitterUpdated":
      return {
        eventName,
        args: {
          oldPaymentSplitter: args[0],
          newPaymentSplitter: args[1],
        },
      };

    case "NftDeployed":
      return {
        eventName,
        args: {
          owner: args[0],
          nft: args[1],
          paymentSplitter: args[2],
        },
      };

    default:
      return {
        eventName,
        args,
      };
  }
}

export function subTitle(title: string) {
  console.log(`\n ${"-".repeat(5)} ${title}`);
}

export function getContractName(saleType: string) {
  return saleType == SaleType.OPEN_SALE ? ERC721_OS_V2 : ERC721_CS_V2;
}

export function autoGen() {
  let id = 0;
  return () => {
    return ++id;
  };
}
