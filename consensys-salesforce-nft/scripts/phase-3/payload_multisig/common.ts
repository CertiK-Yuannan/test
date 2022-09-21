import { getAccounts, signTypedeData } from "../accounts";
import { PayloadType } from "../common";

export async function createMultiSigParam(payload: any, nonce: number, signerIdxs: number[]) {
  const accounts = getAccounts();
  const signatures = [];
  for (const idx of signerIdxs) {
    const signature = await signTypedeData(payload, accounts[idx].privateKey, PayloadType.MULTISIG);
    signatures.push(signature);
  }
  const multiSigParam = {
    nonce,
    signatures,
  };
  return multiSigParam;
}
