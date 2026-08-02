/** Factory for a MandateRegistry contract client wired to a network + signer. */
import { Client } from "./client.js";
import type { NetworkConfig } from "./config.js";
import type { KeypairSigner } from "./signer.js";
export declare function registryClient(net: NetworkConfig, signer: KeypairSigner): Client;
