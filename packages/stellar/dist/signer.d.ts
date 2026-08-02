/** Turn a Stellar secret key (or Keypair) into the signer shape the contract
 *  client and transaction builders need. */
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
export interface KeypairSigner {
    publicKey: string;
    keypair: Keypair;
    signTransaction: ReturnType<typeof basicNodeSigner>["signTransaction"];
    signAuthEntry: ReturnType<typeof basicNodeSigner>["signAuthEntry"];
}
export declare function keypairSigner(secretOrKeypair: string | Keypair, networkPassphrase: string): KeypairSigner;
