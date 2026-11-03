/**
 * IndexedDB Wrapper Utility
 * Provides async CRUD operations for browser-based persistent storage
 */

const DB_NAME = 'bmt_db';
const DB_VERSION = 1;
const PROGRESSIONS_STORE = 'progressions';

let dbInstance: IDBDatabase | null = null;

/**
 * Opens and initializes the IndexedDB database
 * Creates object stores if they don't exist
 */
export async function openDB(): Promise<IDBDatabase> {
	if (typeof window === 'undefined') {
		throw new Error('IndexedDB is not available in this environment');
	}

	// Return cached instance if available
	if (dbInstance) {
		return dbInstance;
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(new Error(`Failed to open database: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(request.result);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Create progressions object store with 'id' as keyPath
			if (!db.objectStoreNames.contains(PROGRESSIONS_STORE)) {
				db.createObjectStore(PROGRESSIONS_STORE, { keyPath: 'id' });
			}
		};
	});
}

/**
 * Run a single request against an object store in its own transaction
 * @param failure - What failed, for the error message (e.g. "add record")
 */
async function runRequest<T>(
	storeName: string,
	mode: IDBTransactionMode,
	makeRequest: (store: IDBObjectStore) => IDBRequest<T>,
	failure: string
): Promise<T> {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const request = makeRequest(db.transaction(storeName, mode).objectStore(storeName));

		request.onerror = () => {
			reject(new Error(`Failed to ${failure}: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			resolve(request.result);
		};
	});
}

/**
 * Adds a record to the specified object store
 */
export async function addRecord<T extends { id: string }>(storeName: string, data: T): Promise<T> {
	await runRequest(storeName, 'readwrite', (store) => store.add(data), 'add record');
	return data;
}

/**
 * Retrieves all records from the specified object store
 */
export async function getAllRecords<T>(storeName: string): Promise<T[]> {
	return runRequest(storeName, 'readonly', (store) => store.getAll(), 'get records');
}

/**
 * Deletes a record by ID from the specified object store
 */
export async function deleteRecord(storeName: string, id: string): Promise<void> {
	await runRequest(storeName, 'readwrite', (store) => store.delete(id), 'delete record');
}

/**
 * Closes the database connection
 * Useful for testing cleanup
 */
export function closeDB(): void {
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
}

/**
 * Deletes the entire database
 * Useful for testing cleanup
 */
export async function deleteDB(): Promise<void> {
	closeDB();

	if (typeof window === 'undefined') {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(DB_NAME);

		request.onerror = () => {
			reject(new Error(`Failed to delete database: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			resolve();
		};
	});
}

// Export store name for use in persistence utilities
export { PROGRESSIONS_STORE };
