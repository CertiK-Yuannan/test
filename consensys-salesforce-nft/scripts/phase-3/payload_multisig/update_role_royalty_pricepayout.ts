export function createPayload(
  contractAddress: string,
  chainId: number,
  nonce: number,
  grantRoles: string[],
  grantRoleAddresses: string[],
  revokeRoles: string[],
  revokeRoleAddresses: string[],
  totalRoyalty: number,
  payees: string[],
  shares: number[],
  pricePayoutWallets: string[]
) {
  const payload = {
    types: {
      //  REQD Domain structure for EIP-712
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],

      //  Custom Data structure for `updateRoleRoyaltyPayout` MultiSig
      MultiSig: [
        { name: "grantRoles", type: "bytes32[]" },
        { name: "grantRoleAddresses", type: "address[]" },
        { name: "revokeRoles", type: "bytes32[]" },
        { name: "revokeRoleAddresses", type: "address[]" },
        { name: "totalRoyalty", type: "uint96" },
        { name: "payees", type: "address[]" },
        { name: "shares", type: "uint256[]" },
        { name: "pricePayoutWallets", type: "address[]" },
        { name: "nonce", type: "uint256" },
        { name: "functionABI", type: "string" },
      ],
    },

    primaryType: "MultiSig",

    //  EIP712Domain Data
    domain: {
      name: "Erc721Verifier",
      version: "V2",
      chainId,
      verifyingContract: contractAddress,
    },

    //  `updateRoleRoyaltyPayout` Data
    message: {
      grantRoles,
      grantRoleAddresses,
      revokeRoles,
      revokeRoleAddresses,
      totalRoyalty,
      payees,
      shares,
      pricePayoutWallets,
      nonce,
      functionABI:
        "updateRoleRoyaltyPayout(bytes32[],address[],bytes32[],address[],uint96,address[],uint256[],address[],MultiSigParams)",
    },
  };
  return payload;
}
