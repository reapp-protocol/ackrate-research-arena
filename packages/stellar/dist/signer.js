/** Turn a Stellar secret key (or Keypair) into the signer shape the contract
 *  client and transaction builders need. */
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
export function keypairSigner(secretOrKeypair, networkPassphrase) {
    const keypair = typeof secretOrKeypair === "string" ? Keypair.fromSecret(secretOrKeypair) : secretOrKeypair;
    const node = basicNodeSigner(keypair, networkPassphrase);
    return {
        publicKey: keypair.publicKey(),
        keypair,
        signTransaction: node.signTransaction,
        signAuthEntry: node.signAuthEntry,
    };
}
