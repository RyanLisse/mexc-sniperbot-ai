declare module "encore.dev/service" {
  export interface ServiceOptions {
    middlewares?: unknown[];
  }

  export class Service {
    constructor(name: string, options?: ServiceOptions);
  }
}

declare module "encore.dev/config" {
  export function secret(name: string): () => string;
}

declare module "encore.dev/storage/sqldb" {
  export interface SQLDatabaseOptions {
    migrations: string;
  }

  export class SQLDatabase {
    constructor(name: string, options: SQLDatabaseOptions);
    readonly connectionString: string;
  }
}

declare module "encore.dev/api" {
  export interface APIOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path?: string;
    expose?: boolean;
    auth?: boolean;
  }

  export function api<Req, Resp>(
    options: APIOptions,
    handler: (req: Req) => Promise<Resp>
  ): (req: Req) => Promise<Resp>;

  export class APIError extends Error {
    constructor(code: ErrCode, message: string, details?: unknown);
  }

  export enum ErrCode {
    OK = 0,
    Canceled = 1,
    Unknown = 2,
    InvalidArgument = 3,
    DeadlineExceeded = 4,
    NotFound = 5,
    AlreadyExists = 6,
    PermissionDenied = 7,
    ResourceExhausted = 8,
    FailedPrecondition = 9,
    Aborted = 10,
    OutOfRange = 11,
    Unimplemented = 12,
    Internal = 13,
    Unavailable = 14,
    DataLoss = 15,
    Unauthenticated = 16,
  }
}
