/**
 * Playback Port
 * The only way stores reach the playback layer. Stores sit below playback (`audio-playback.ts`,
 * `audition-controller.ts`) and must not import it, so they call these hooks instead and the
 * playback modules fill them in when they load.
 *
 * The defaults are deliberately no-ops: if the playback layer isn't loaded, there is no loop to
 * reschedule and no audition to cancel. Hooks are assigned (not subscribed), so re-loading a
 * module under HMR replaces its hook instead of stacking a second one.
 */

export interface PlaybackPort {
	/** A slot's chord, duration or the slot list changed; reschedule the running loop */
	slotChanged: (index: number) => void;
	/** Slot under the playhead, or null when nothing is playing */
	playheadSlot: () => number | null;
	/** End any audition in flight, including its note-offs */
	interruptAudition: () => void;
}

export const playbackPort: PlaybackPort = {
	slotChanged: () => {},
	playheadSlot: () => null,
	interruptAudition: () => {}
};
