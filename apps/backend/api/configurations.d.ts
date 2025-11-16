type Configuration = {
    id: string;
    name: string;
    symbols: string[];
    quoteAmount: number;
    maxTradesPerHour: number;
    maxDailySpend: number;
    recvWindow: number;
    safetyEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
};
type CreateConfigurationRequest = {
    name: string;
    symbols: string[];
    quoteAmount: number;
    maxTradesPerHour: number;
    maxDailySpend: number;
    recvWindow: number;
    safetyEnabled: boolean;
};
type ListConfigurationsRequest = {
    limit?: number;
    offset?: number;
};
type ListConfigurationsResponse = {
    configurations: Configuration[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
};
type GetConfigurationRequest = {
    id: string;
};
export declare const createConfiguration: (req: CreateConfigurationRequest) => Promise<Configuration>;
export declare const listConfigurations: (req: ListConfigurationsRequest) => Promise<ListConfigurationsResponse>;
export declare const getConfiguration: (req: GetConfigurationRequest) => Promise<Configuration>;
export declare const deleteConfiguration: (req: GetConfigurationRequest) => Promise<void>;
export {};
