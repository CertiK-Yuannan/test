export function createPayload(
  contractAddress: string,
  chainId: number,
  nonce: number,
  tokenIds: number[],
  pause: boolean
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

      //  Custom Data structure for `pauseTokens` MultiSig
      MultiSig: [
        { name: "tokenIds", type: "uint256[]" },
        { name: "pause", type: "bool" },
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

    //  `pauseTokens` Data
    message: {
      tokenIds,
      pause,
      nonce,
      functionABI: "pauseTokens(uint256[],bool,MultiSigParams)",
    },
  };
  return payload;
}