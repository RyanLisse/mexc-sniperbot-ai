declare module "encore.dev/service" {
  export type ServiceOptions = {
    middlewares?: unknown[];
  };

  export class Service {
    constructor(name: string, options?: ServiceOptions);
  }
}

declare module "encore.dev/config" {
  export function secret(name: string): () => string;
}

declare module "encore.dev/storage/sqldb" {
  export type SQLDatabaseOptions = {
    migrations: string;
  };

  export class SQLDatabase {
    constructor(name: string, options: SQLDatabaseOptions);
    readonly connectionString: string;
    exec(strings: TemplateStringsArray, ...values: unknown[]): Promise<void>;
    queryRow<T>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<T>;
    queryAll<T>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<T[]>;
    rawQueryAll<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  }
}

declare module "encore.dev/api" {
  export type APIOptions = {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path?: string;
    expose?: boolean;
    auth?: boolean;
  };

  export type Query<T> = T;

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

declare module "encore.dev/log" {
  const log: {
    info(message: string, fields?: unknown): void;
    warn(message: string, fields?: unknown): void;
    error(message: string, fields?: unknown): void;
  };

  export default log;
}
