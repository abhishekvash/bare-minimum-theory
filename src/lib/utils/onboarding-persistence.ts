/**
 * Onboarding Persistence Utility
 * Handles localStorage load/save for the first-run tour flag
 */

import { loadLocalSetting, saveLocalSetting } from './local-setting';

const ONBOARDING_SETTINGS_KEY = 'bmt_onboarding';

/**
 * Current tour revision. Bump it when the tour changes enough that returning visitors
 * should see it again; anyone who saw an older revision counts as not having seen it.
 */
export const TOUR_VERSION = 1;

/**
 * Persisted onboarding state
 */
export interface OnboardingSettings {
	/** Revision of the tour the visitor last finished or dismissed (0 = never seen) */
	tourVersion: number;
}

/**
 * Default onboarding settings (tour never seen)
 */
export const DEFAULT_ONBOARDING_SETTINGS: OnboardingSettings = {
	tourVersion: 0
};

/**
 * Load onboarding settings from localStorage
 * Returns defaults if not found or invalid
 */
export function loadOnboardingSettings(): OnboardingSettings {
	return loadLocalSetting(
		ONBOARDING_SETTINGS_KEY,
		DEFAULT_ONBOARDING_SETTINGS,
		(stored, defaults) => ({
			tourVersion:
				typeof stored.tourVersion === 'number' && Number.isInteger(stored.tourVersion)
					? stored.tourVersion
					: defaults.tourVersion
		})
	);
}

/**
 * Whether the visitor has already finished or dismissed the current tour revision
 */
export function hasSeenTour(): boolean {
	return loadOnboardingSettings().tourVersion >= TOUR_VERSION;
}

/**
 * Record that the current tour revision has been seen
 */
export function markTourSeen(): void {
	saveLocalSetting(ONBOARDING_SETTINGS_KEY, { tourVersion: TOUR_VERSION });
}
