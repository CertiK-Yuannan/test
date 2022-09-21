export function createPayload(contractAddress: string, chainId: number, nonce: number) {
  const payload = {
    types: {
      //  REQD Domain structure for EIP-712
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],

      //  Custom Data structure for `togglePauseState` MultiSig
      MultiSig: [
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

    //  `togglePauseState` Data
    message: {
      nonce,
      functionABI: "togglePauseState(MultiSigParams)",
    },
  };
  return payload;
}
