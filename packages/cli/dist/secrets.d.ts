export type Credentials = {
    network: "testnet";
    userSecret: string;
    userPublic: string;
    agentSecret: string;
    agentPublic: string;
    merchantSecret: string;
    merchantPublic: string;
};
export declare function ackrateHome(): string;
export declare function credentialsPath(): string;
export declare function credentialsExist(): boolean;
export declare function loadCredentials(): Credentials;
export declare function saveCredentials(creds: Credentials): string;
