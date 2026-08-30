import {
  createClient,
  type Client,
  type InStatement,
  type InValue,
  type ResultSet,
} from "@libsql/client";
import {
  del as deleteBlob,
  get as getBlob,
  put as putBlob,
  type GetBlobResult,
  type PutBlobResult,
} from "@vercel/blob";
import {
  toPrivateBlobLocation,
  toPrivateBlobPathname,
  type ResolvedVercelPersistenceEnvironment,
} from "./persistence-runtime";

export {
  getConfiguredPersistenceRuntime,
  hasVercelPersistenceSignal,
  readVercelPersistenceEnvironment,
  toPrivateBlobLocation,
  toPrivateBlobLocator,
  toPrivateBlobPathname,
  toPrivateBlobUrl,
  VercelPersistenceConfigurationError,
  type PersistenceRuntime,
  type PrivateBlobLocator,
  type ResolvedVercelPersistenceEnvironment,
  type VercelPersistenceEnvironment,
} from "./persistence-runtime";

export type LibsqlClient = Pick<Client, "execute" | "batch">;

function normalizeBoundValue(value: unknown): InValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    value instanceof Date ||
    value instanceof ArrayBuffer ||
    value instanceof Uint8Array
  ) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return Uint8Array.from(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    );
  }

  throw new TypeError(`D1-bindingsværdien har en ikke-understøttet type: ${typeof value}.`);
}

function plainRow(result: ResultSet, rowIndex: number) {
  const row = result.rows[rowIndex];
  if (!row) return null;
  return Object.fromEntries(
    result.columns.map((column, columnIndex) => [column, row[columnIndex]]),
  );
}

function toD1Result<T>(result: ResultSet): D1Result<T> {
  const results = result.rows.map((_, rowIndex) => plainRow(result, rowIndex) as T);
  const changes = Number(result.rowsAffected || 0);
  const lastRowId = result.lastInsertRowid === undefined
    ? 0
    : Number(result.lastInsertRowid);

  return {
    success: true,
    results,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: results.length,
      rows_written: changes,
      last_row_id: lastRowId,
      changed_db: changes > 0,
      changes,
    },
  };
}

class LibsqlD1PreparedStatementAdapter {
  constructor(
    private readonly client: LibsqlClient,
    private readonly sql: string,
    private readonly arguments_: InValue[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new LibsqlD1PreparedStatementAdapter(
      this.client,
      this.sql,
      values.map(normalizeBoundValue),
    );
  }

  async first<T = Record<string, unknown>>(): Promise<T | null>;
  async first<T = unknown>(columnName: string): Promise<T | null>;
  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const result = await this.client.execute(this.toLibsqlStatement());
    const row = plainRow(result, 0);
    if (!row) return null;
    if (columnName !== undefined) {
      return (row[columnName] ?? null) as T | null;
    }
    return row as T;
  }

  async all<T = Record<string, unknown>>() {
    return toD1Result<T>(await this.client.execute(this.toLibsqlStatement()));
  }

  async run<T = Record<string, unknown>>() {
    return toD1Result<T>(await this.client.execute(this.toLibsqlStatement()));
  }

  belongsTo(client: LibsqlClient) {
    return client === this.client;
  }

  toLibsqlStatement(): InStatement {
    return { sql: this.sql, args: this.arguments_ };
  }
}

class LibsqlD1DatabaseAdapter {
  constructor(private readonly client: LibsqlClient) {}

  prepare(query: string) {
    return new LibsqlD1PreparedStatementAdapter(this.client, query) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]) {
    const libsqlStatements = statements.map((statement) => {
      if (
        !(statement instanceof LibsqlD1PreparedStatementAdapter) ||
        !statement.belongsTo(this.client)
      ) {
        throw new TypeError("DB.batch modtog en statement fra en anden databaseadapter.");
      }
      return statement.toLibsqlStatement();
    });

    const results = await this.client.batch(libsqlStatements, "write");
    return results.map((result) => toD1Result<T>(result));
  }
}

export function createLibsqlD1Adapter(client: LibsqlClient): D1Database {
  return new LibsqlD1DatabaseAdapter(client) as unknown as D1Database;
}

/** Enable the same referential-integrity semantics that D1 applies. */
export async function enableLibsqlForeignKeys(client: Pick<Client, "execute">) {
  await client.execute("PRAGMA foreign_keys = ON");
}

type BlobPutBody = Parameters<typeof putBlob>[1];
type BlobPutOptions = Parameters<typeof putBlob>[2];
type BlobGetOptions = Parameters<typeof getBlob>[1];
type BlobDeleteOptions = Parameters<typeof deleteBlob>[1];

export type PrivateBlobSdk = {
  put(
    pathname: string,
    body: BlobPutBody,
    options: BlobPutOptions,
  ): Promise<PutBlobResult>;
  get(pathname: string, options: BlobGetOptions): Promise<GetBlobResult | null>;
  del(pathname: string | string[], options?: BlobDeleteOptions): Promise<void>;
};

const privateBlobSdk: PrivateBlobSdk = {
  put: putBlob,
  get: getBlob,
  del: deleteBlob,
};

function r2HttpMetadata(options?: R2PutOptions) {
  if (!options?.httpMetadata) return undefined;
  if (options.httpMetadata instanceof Headers) {
    return {
      contentType: options.httpMetadata.get("content-type") ?? undefined,
      contentDisposition: options.httpMetadata.get("content-disposition") ?? undefined,
      contentLanguage: options.httpMetadata.get("content-language") ?? undefined,
      contentEncoding: options.httpMetadata.get("content-encoding") ?? undefined,
      cacheControl: options.httpMetadata.get("cache-control") ?? undefined,
    } satisfies R2HTTPMetadata;
  }
  return options.httpMetadata;
}

function toBlobBody(
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
): BlobPutBody {
  if (value === null) return new ArrayBuffer(0);
  if (ArrayBuffer.isView(value)) {
    return Uint8Array.from(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    ).buffer;
  }
  return value as BlobPutBody;
}

function bodySize(
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
) {
  if (value === null) return 0;
  if (typeof value === "string") return new TextEncoder().encode(value).byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof Blob) return value.size;
  return 0;
}

function writeR2HttpMetadata(metadata: R2HTTPMetadata | undefined, headers: Headers) {
  if (!metadata) return;
  if (metadata.contentType) headers.set("content-type", metadata.contentType);
  if (metadata.contentDisposition) headers.set("content-disposition", metadata.contentDisposition);
  if (metadata.contentLanguage) headers.set("content-language", metadata.contentLanguage);
  if (metadata.contentEncoding) headers.set("content-encoding", metadata.contentEncoding);
  if (metadata.cacheControl) headers.set("cache-control", metadata.cacheControl);
  if (metadata.cacheExpiry) headers.set("expires", metadata.cacheExpiry.toUTCString());
}

function emptyChecksums(): R2Checksums {
  return { toJSON: () => ({}) };
}

function blobResultToR2Object(
  blob: PutBlobResult,
  size: number,
  metadata: R2HTTPMetadata | undefined,
): R2Object {
  return {
    key: toPrivateBlobLocation(blob.url),
    version: blob.etag,
    size,
    etag: blob.etag,
    httpEtag: blob.etag,
    checksums: emptyChecksums(),
    uploaded: new Date(),
    httpMetadata: {
      ...metadata,
      contentType: blob.contentType || metadata?.contentType,
      contentDisposition: blob.contentDisposition || metadata?.contentDisposition,
    },
    customMetadata: {},
    storageClass: "Standard",
    writeHttpMetadata(headers) {
      writeR2HttpMetadata(this.httpMetadata, headers);
    },
  };
}

function downloadedBlobToR2Object(result: Extract<GetBlobResult, { statusCode: 200 }>): R2ObjectBody {
  const response = new Response(result.stream);
  const metadata: R2HTTPMetadata = {
    contentType: result.blob.contentType,
    contentDisposition: result.blob.contentDisposition,
    cacheControl: result.blob.cacheControl,
  };

  return {
    key: toPrivateBlobLocation(result.blob.url),
    version: result.blob.etag,
    size: result.blob.size,
    etag: result.blob.etag,
    httpEtag: result.blob.etag,
    checksums: emptyChecksums(),
    uploaded: result.blob.uploadedAt,
    httpMetadata: metadata,
    customMetadata: {},
    storageClass: "Standard",
    get body() {
      return response.body as ReadableStream;
    },
    get bodyUsed() {
      return response.bodyUsed;
    },
    arrayBuffer: () => response.arrayBuffer(),
    async bytes() {
      return new Uint8Array(await response.arrayBuffer());
    },
    text: () => response.text(),
    json: <T>() => response.json() as Promise<T>,
    blob: () => response.blob(),
    writeHttpMetadata(headers) {
      writeR2HttpMetadata(metadata, headers);
    },
  };
}

class PrivateBlobR2BucketAdapter {
  constructor(
    private readonly authentication: PrivateBlobAuthentication,
    private readonly sdk: PrivateBlobSdk,
  ) {}

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: R2PutOptions,
  ) {
    const pathname = toPrivateBlobPathname(key);
    const metadata = r2HttpMetadata(options);
    const stored = await this.sdk.put(pathname, toBlobBody(value), {
      access: "private",
      ...privateBlobCommandAuthentication(this.authentication),
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: metadata?.contentType,
    });
    return blobResultToR2Object(stored, bodySize(value), metadata);
  }

  async get(key: string) {
    const result = await this.sdk.get(toPrivateBlobLocation(key), {
      access: "private",
      ...privateBlobCommandAuthentication(this.authentication),
      useCache: false,
    });
    if (!result || result.statusCode !== 200) return null;
    return downloadedBlobToR2Object(result);
  }

  async delete(keys: string | string[]) {
    const pathnames = Array.isArray(keys)
      ? keys.map(toPrivateBlobLocation)
      : toPrivateBlobLocation(keys);
    await this.sdk.del(
      pathnames,
      privateBlobCommandAuthentication(this.authentication),
    );
  }
}

export type PrivateBlobAuthentication =
  | { blobToken: string }
  | { blobStoreId: string; blobOidcToken?: string };

function privateBlobCommandAuthentication(
  authentication: PrivateBlobAuthentication,
) {
  return "blobToken" in authentication
    ? { token: authentication.blobToken }
    : {
        storeId: authentication.blobStoreId,
        ...(authentication.blobOidcToken
          ? { oidcToken: authentication.blobOidcToken }
          : {}),
      };
}

export function createPrivateBlobR2Adapter(
  authentication: string | PrivateBlobAuthentication,
  sdk: PrivateBlobSdk = privateBlobSdk,
): R2Bucket {
  return new PrivateBlobR2BucketAdapter(
    typeof authentication === "string"
      ? { blobToken: authentication }
      : authentication,
    sdk,
  ) as unknown as R2Bucket;
}

export async function createVercelPersistenceBindings(
  environment: ResolvedVercelPersistenceEnvironment,
  dependencies?: {
    client?: Client;
    blobSdk?: PrivateBlobSdk;
  },
) {
  const client = dependencies?.client ?? createClient({
    url: environment.databaseUrl,
    authToken: environment.authToken,
    intMode: "number",
  });
  await enableLibsqlForeignKeys(client);

  return {
    DB: createLibsqlD1Adapter(client),
    FILES: createPrivateBlobR2Adapter(environment, dependencies?.blobSdk),
  };
}
