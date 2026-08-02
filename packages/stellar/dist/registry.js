/** Factory for a MandateRegistry contract client wired to a network + signer. */
import { Client } from "./client.js";
export function registryClient(net, signer) {
    return new Client({
        contractId: net.mandateRegistryId,
        rpcUrl: net.rpcUrl,
        networkPassphrase: net.networkPassphrase,
        publicKey: signer.publicKey,
        signTransaction: signer.signTransaction,
        allowHttp: net.rpcUrl.startsWith("http://"),
    });
}
