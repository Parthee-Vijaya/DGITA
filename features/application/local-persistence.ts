import type {
  ApplicationFormState,
  AttachmentDraft,
  UploadKind,
} from "./engine";

const DATABASE_NAME = "dgita-local-persistence";
const DATABASE_VERSION = 1;
const DRAFT_STORE = "drafts";
const FILE_STORE = "files";

export type LocalDraftStatus = "draft" | "submitted";

export type LocalDraftRecord = {
  id: string;
  state: ApplicationFormState;
  status: LocalDraftStatus;
  updatedAt: string;
};

type LocalFileRecord = {
  id: string;
  draftId: string;
  kind: UploadKind;
  name: string;
  size: number;
  type: string;
  blob: Blob;
  updatedAt: string;
};

export class LocalPersistenceUnavailableError extends Error {
  constructor(message = "Browserlagring er ikke tilgængelig.") {
    super(message);
    this.name = "LocalPersistenceUnavailableError";
  }
}

export async function getLatestLocalDraft(): Promise<LocalDraftRecord | null> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(DRAFT_STORE, "readonly");
    const records = await requestResult<LocalDraftRecord[]>(
      transaction.objectStore(DRAFT_STORE).getAll(),
    );
    await transactionDone(transaction);

    return (
      records
        .filter(
          (record) =>
            record.status === "draft" &&
            record.state?.schemaVersion === "dgita-v1",
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ??
      null
    );
  });
}

export async function saveLocalDraft(
  id: string,
  state: ApplicationFormState,
  status: LocalDraftStatus,
): Promise<LocalDraftRecord> {
  const record: LocalDraftRecord = {
    id,
    state,
    status,
    updatedAt: new Date().toISOString(),
  };

  await withDatabase(async (database) => {
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    transaction.objectStore(DRAFT_STORE).put(record);
    await transactionDone(transaction);
  });

  return record;
}

export async function saveLocalAttachment(
  draftId: string,
  attachment: AttachmentDraft,
  file: File,
): Promise<void> {
  const record: LocalFileRecord = {
    id: attachment.id,
    draftId,
    kind: attachment.kind,
    name: attachment.name,
    size: attachment.size,
    type: attachment.type || "application/octet-stream",
    blob: file.slice(0, file.size, file.type || "application/octet-stream"),
    updatedAt: new Date().toISOString(),
  };

  await withDatabase(async (database) => {
    const transaction = database.transaction(FILE_STORE, "readwrite");
    transaction.objectStore(FILE_STORE).put(record);
    await transactionDone(transaction);
  });
}

export async function deleteLocalAttachment(
  draftId: string,
  attachmentId: string,
): Promise<void> {
  await withDatabase(async (database) => {
    const readTransaction = database.transaction(FILE_STORE, "readonly");
    const record = await requestResult<LocalFileRecord | undefined>(
      readTransaction.objectStore(FILE_STORE).get(attachmentId),
    );
    await transactionDone(readTransaction);

    if (!record || record.draftId !== draftId) return;

    const deleteTransaction = database.transaction(FILE_STORE, "readwrite");
    deleteTransaction.objectStore(FILE_STORE).delete(attachmentId);
    await transactionDone(deleteTransaction);
  });
}

export async function getLocalAttachmentBlob(
  draftId: string,
  attachmentId: string,
): Promise<Blob | null> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(FILE_STORE, "readonly");
    const record = await requestResult<LocalFileRecord | undefined>(
      transaction.objectStore(FILE_STORE).get(attachmentId),
    );
    await transactionDone(transaction);
    return record?.draftId === draftId ? record.blob : null;
  });
}

async function withDatabase<T>(
  operation: (database: IDBDatabase) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await operation(database);
  } finally {
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new LocalPersistenceUnavailableError());
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        database.createObjectStore(DRAFT_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(FILE_STORE)) {
        const files = database.createObjectStore(FILE_STORE, { keyPath: "id" });
        files.createIndex("draftId", "draftId", { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(
        new LocalPersistenceUnavailableError(
          request.error?.message || "Browserlagring kunne ikke åbnes.",
        ),
      );
    request.onblocked = () =>
      reject(
        new LocalPersistenceUnavailableError(
          "Browserlagring er låst af en anden åben fane.",
        ),
      );
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browserlagring fejlede."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Browserlagring fejlede."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Browserlagring blev afbrudt."));
  });
}
