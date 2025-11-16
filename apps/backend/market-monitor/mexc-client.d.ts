declare class MEXCClient {
    private ws;
    private knownSymbols;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    initialize(): Promise<void>;
    private loadKnownSymbols;
    private connect;
    private reconnect;
    private subscribeToAllSymbols;
    private handleMessage;
    private processTicker;
    private detectNewListing;
    private fetchSymbolInfo;
    shutdown(): Promise<void>;
}
export declare const mexcClient: MEXCClient;
export {};
