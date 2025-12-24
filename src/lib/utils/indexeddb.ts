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
 * Adds a record to the specified object store
 */
export async function addRecord<T extends { id: string }>(
	storeName: string,
	data: T
): Promise<T> {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readwrite');
		const store = transaction.objectStore(storeName);
		const request = store.add(data);

		request.onerror = () => {
			reject(new Error(`Failed to add record: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			resolve(data);
		};
	});
}

/**
 * Retrieves all records from the specified object store
 */
export async function getAllRecords<T>(storeName: string): Promise<T[]> {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readonly');
		const store = transaction.objectStore(storeName);
		const request = store.getAll();

		request.onerror = () => {
			reject(new Error(`Failed to get records: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			resolve(request.result);
		};
	});
}

/**
 * Retrieves a single record by ID from the specified object store
 */
export async function getRecord<T>(storeName: string, id: string): Promise<T | undefined> {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readonly');
		const store = transaction.objectStore(storeName);
		const request = store.get(id);

		request.onerror = () => {
			reject(new Error(`Failed to get record: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			resolve(request.result);
		};
	});
}

/**
 * Deletes a record by ID from the specified object store
 */
export async function deleteRecord(storeName: string, id: string): Promise<void> {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readwrite');
		const store = transaction.objectStore(storeName);
		const request = store.delete(id);

		request.onerror = () => {
			reject(new Error(`Failed to delete record: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			resolve();
		};
	});
}

/**
 * Clears all records from the specified object store
 * Useful for testing or reset functionality
 */
export async function clearStore(storeName: string): Promise<void> {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readwrite');
		const store = transaction.objectStore(storeName);
		const request = store.clear();

		request.onerror = () => {
			reject(new Error(`Failed to clear store: ${request.error?.message}`));
		};

		request.onsuccess = () => {
			resolve();
		};
	});
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
		return;
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
