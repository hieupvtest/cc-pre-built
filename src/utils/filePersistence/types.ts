// Stub: filePersistence types were tree-shaken from the source map
export type TurnStartTime = number;
export type FilePersistenceConfig = Record<string, unknown>;
export type PersistenceState = Record<string, unknown>;
export type FileOutputEntry = { path: string; content: string };
export type FailedPersistence = { path: string; error: string };
export type FilesPersistedEventData = { files: string[]; count: number };
export type PersistedFile = { path: string; hash: string; size: number };

export const DEFAULT_UPLOAD_CONCURRENCY = 5;
export const FILE_COUNT_LIMIT = 1000;
export const OUTPUTS_SUBDIR = '.outputs';
