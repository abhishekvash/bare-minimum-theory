/**
 * Local Setting Storage
 * The shared localStorage load/save policy behind every persisted preference: SSR-safe,
 * silent on missing or corrupt data, and never handing out the caller's defaults object
 * itself. Each preference keeps its own key and field validation in `normalize`.
 */

/**
 * Load a JSON setting from localStorage
 * @param key - Storage key
 * @param defaults - Value to fall back to; a fresh copy is returned, never this object
 * @param normalize - Builds a valid setting from the stored object, using defaults for any
 *   missing or invalid field
 * @returns The stored setting, or a copy of the defaults when absent, corrupt or not an object
 */
export function loadLocalSetting<T extends object>(
	key: string,
	defaults: T,
	normalize: (stored: Record<string, unknown>, defaults: T) => T
): T {
	if (typeof window === 'undefined') return { ...defaults };

	try {
		const raw = localStorage.getItem(key);
		if (!raw) return { ...defaults };

		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return { ...defaults };

		return normalize(parsed as Record<string, unknown>, defaults);
	} catch {
		return { ...defaults };
	}
}

/**
 * Save a JSON setting to localStorage (a no-op during SSR)
 * @param key - Storage key
 * @param value - Setting to store
 */
export function saveLocalSetting<T>(key: string, value: T): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(key, JSON.stringify(value));
}
