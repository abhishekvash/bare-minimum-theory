import { describe, it, expect, beforeEach } from 'vitest';
import {
	DEFAULT_ONBOARDING_SETTINGS,
	TOUR_VERSION,
	hasSeenTour,
	loadOnboardingSettings,
	markTourSeen
} from '$lib/utils/onboarding-persistence';

const KEY = 'bmt_onboarding';

describe('onboarding-persistence', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('defaults to never having seen the tour', () => {
		expect(loadOnboardingSettings()).toEqual(DEFAULT_ONBOARDING_SETTINGS);
		expect(hasSeenTour()).toBe(false);
	});

	it('remembers the tour once it has been seen', () => {
		markTourSeen();

		expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ tourVersion: TOUR_VERSION });
		expect(hasSeenTour()).toBe(true);
	});

	it('shows the tour again to visitors who only saw an older revision', () => {
		localStorage.setItem(KEY, JSON.stringify({ tourVersion: TOUR_VERSION - 1 }));
		expect(hasSeenTour()).toBe(false);
	});

	it('treats corrupt or invalid data as never seen', () => {
		localStorage.setItem(KEY, 'not json {{{');
		expect(hasSeenTour()).toBe(false);

		localStorage.setItem(KEY, JSON.stringify({ tourVersion: 'yes' }));
		expect(loadOnboardingSettings()).toEqual(DEFAULT_ONBOARDING_SETTINGS);

		localStorage.setItem(KEY, JSON.stringify({ tourVersion: 1.5 }));
		expect(loadOnboardingSettings()).toEqual(DEFAULT_ONBOARDING_SETTINGS);
	});
});
