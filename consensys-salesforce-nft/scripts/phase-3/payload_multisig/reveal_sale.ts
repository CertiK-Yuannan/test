export function createPayload(contractAddress: string, chainId: number, nonce: number, baseURI: string) {
  const payload = {
    types: {
      //  REQD Domain structure for EIP-712
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],

      //  Custom Data structure for `revealSale` MultiSig
      MultiSig: [
        { name: "baseURI", type: "string" },
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

    //  `revealSale` Data
    message: {
      baseURI,
      nonce,
      functionABI: "revealSale(string,MultiSigParams)",
    },
  };
  return payload;
}