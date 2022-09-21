import {
  Account,
  CONTRACT_ADMIN_ROLE,
  FINANCE_ADMIN_ROLE,
  IDX_CONTRACT_ADMIN_1,
  IDX_CONTRACT_ADMIN_2,
  IDX_CONTRACT_ADMIN_3,
  IDX_CONTRACT_ADMIN_4,
  IDX_FINANCE_ADMIN_1,
  IDX_FINANCE_ADMIN_2,
  IDX_FINANCE_ADMIN_3,
  IDX_FINANCE_ADMIN_4,
  IDX_PAYEE_1,
  IDX_PAYEE_2,
  IDX_PRICE_PAYOUT,
  IDX_VOUCHER_SIGNER_1,
  IDX_VOUCHER_SIGNER_2,
  IDX_VOUCHER_SIGNER_3,
  IDX_VOUCHER_SIGNER_4,
  VOUCHER_SIGNER_ROLE,
} from "./accounts";
import { SaleParams, OpenSaleParams, ClosedSaleParams } from "./common";

export function createSaleParams(accounts: Account[], override: Partial<SaleParams> = {}): SaleParams {
  const params: SaleParams = {
    name: "Phase-3 NFT Sale",
    symbol: "AAA",
    baseURI: "https://some-baseURI",
    contractURI: "https://some-contractURI",
    totalRoyalty: 2500, // 25%
    maxSupply: 10,
    maxTokensPerWallet: 5,
    pricePayoutWallet: accounts[IDX_PRICE_PAYOUT].address,
    roles: [
      CONTRACT_ADMIN_ROLE,
      CONTRACT_ADMIN_ROLE,
      CONTRACT_ADMIN_ROLE,
      CONTRACT_ADMIN_ROLE,

      FINANCE_ADMIN_ROLE,
      FINANCE_ADMIN_ROLE,
      FINANCE_ADMIN_ROLE,
      FINANCE_ADMIN_ROLE,

      VOUCHER_SIGNER_ROLE,
      VOUCHER_SIGNER_ROLE,
      VOUCHER_SIGNER_ROLE,
      VOUCHER_SIGNER_ROLE,
    ],
    roleAddresses: [
      accounts[IDX_CONTRACT_ADMIN_1].address,
      accounts[IDX_CONTRACT_ADMIN_2].address,
      accounts[IDX_CONTRACT_ADMIN_3].address,
      accounts[IDX_CONTRACT_ADMIN_4].address,

      accounts[IDX_FINANCE_ADMIN_1].address,
      accounts[IDX_FINANCE_ADMIN_2].address,
      accounts[IDX_FINANCE_ADMIN_3].address,
      accounts[IDX_FINANCE_ADMIN_4].address,

      accounts[IDX_VOUCHER_SIGNER_1].address,
      accounts[IDX_VOUCHER_SIGNER_2].address,
      accounts[IDX_VOUCHER_SIGNER_3].address,
      accounts[IDX_VOUCHER_SIGNER_4].address,
    ],
    multisigRoles: [],
    multisigThresholds: [],
    payees: [accounts[IDX_PAYEE_1].address, accounts[IDX_PAYEE_2].address],
    shares: [7500, 2500], // 75%, 25%
  };
  return { ...params, ...override };
}

export function createOpenSaleParams(accounts: Account[], override: Partial<OpenSaleParams> = {}): OpenSaleParams {
  const saleParams = createSaleParams(accounts, override);
  const params: OpenSaleParams = {
    ...saleParams,
    name: "Phase-3 NFT Open Sale",
    baseURI: "https://some-baseURI/",
  };
  return { ...params, ...override };
}

export function createClosedSaleParams(
  accounts: Account[],
  override: Partial<ClosedSaleParams> = {}
): ClosedSaleParams {
  const openSaleParams = createOpenSaleParams(accounts, override);
  const params: ClosedSaleParams = {
    ...openSaleParams,
    name: "Phase-3 NFT Closed Sale",
    provenance: "5a666ec89633ae930e01147b6b605a37779019bd36019c2ea8314d5ac661c4a6",
    maxTokensPerTxn: 3,
  };
  return { ...params, ...override };
}

export function multiSigRoleThreshold() {
  return {
    multisigRoles: [CONTRACT_ADMIN_ROLE, FINANCE_ADMIN_ROLE],
    multisigThresholds: [3, 2],
  };
}

export function multiSigParam(nonce = 0, signatures = []) {
  return {
    nonce,
    signatures,
  };
}

export function roleRoyaltyPayout() {
  return {
    roles: {
      grantRoles: [] as string[],
      grantRoleAddresses: [] as string[],
      revokeRoles: [] as string[],
      revokeRoleAddresses: [] as string[],
    },
    royalties: {
      totalRoyalty: 0,
      payees: [] as string[],
      shares: [] as number[],
    },
    pricePayoutWallets: [] as string[],
  };
}
