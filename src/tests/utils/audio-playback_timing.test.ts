import { describe, it, expect } from 'vitest';
import * as Tone from 'tone';

// Mocking Tone.Time as it's hard to use in pure JSDom/Vitest without full audio context
// In reality, we'll use Tone.Time in the code, but for the test of the logic, 
// we'll verify the cumulative offset calculation.

function calculateOffsets(durations: string[], bpm: number): { offsets: number[], total: number } {
    const secondsPerBeat = 60 / bpm;
    const durationMap: Record<string, number> = {
        '1m': 4 * secondsPerBeat,
        '2n': 2 * secondsPerBeat,
        '4n': 1 * secondsPerBeat,
        '8n': 0.5 * secondsPerBeat
    };

    let cumulative = 0;
    const offsets = durations.map(d => {
        const start = cumulative;
        cumulative += durationMap[d] || 2 * secondsPerBeat;
        return start;
    });
    return { offsets, total: cumulative };
}

describe('Playback Timing Logic', () => {
    it('should calculate correct offsets for mixed durations', () => {
        const durations = ['1m', '2n', '4n', '4n'];
        const bpm = 120; // 0.5s per beat, 1m = 2s, 2n = 1s, 4n = 0.5s
        
        const { offsets, total } = calculateOffsets(durations, bpm);
        
        expect(offsets).toEqual([0, 2, 3, 3.5]);
        expect(total).toBe(4);
    });

    it('should handle single measure durations (legacy default)', () => {
        const durations = ['1m', '1m', '1m', '1m'];
        const bpm = 120;
        
        const { offsets, total } = calculateOffsets(durations, bpm);
        
        expect(offsets).toEqual([0, 2, 4, 6]);
        expect(total).toBe(8);
    });
});
