<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Separator } from '$lib/components/ui/separator';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl max-h-[80vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Help & Documentation</Dialog.Title>
			<Dialog.Description>
				Build, shape, save, and export chord progressions in Bare Minimum Theory
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 text-sm">
			<section>
				<h3 class="text-base font-semibold mb-3">Getting Started</h3>
				<p class="text-muted-foreground mb-3">Build a progression from the chord builder:</p>
				<ol class="space-y-2 ml-4 list-decimal list-outside text-muted-foreground">
					<li>
						<strong class="text-foreground">Pick a root note</strong> - Choose any chromatic note.
					</li>
					<li>
						<strong class="text-foreground">Choose a quality</strong> - Click to preview it, press and
						sweep to browse quickly, or hold and drag to place the chord.
					</li>
					<li>
						<strong class="text-foreground">Arrange the canvas</strong> - Drop chords into slots, reorder
						blocks, add slots with the plus button, or insert slots between chords.
					</li>
				</ol>
				<p class="text-muted-foreground mt-3">
					The canvas starts with four slots and can grow to 16. Your last root and quality stay
					selected so you can add related chords quickly.
				</p>
			</section>

			<Separator />

			<section>
				<h3 class="text-base font-semibold mb-3">Discover by Ear</h3>
				<div class="space-y-3 text-muted-foreground">
					<p>
						While stopped, clicking a quality previews your candidate. For a chained preview, turn
						on
						<strong class="text-foreground">Preview in context</strong> in Settings: the nearest earlier
						chord plays first, so you hear the change in context.
					</p>
					<p>
						Press and sweep across qualities for fast candidate-only previews. Release to choose the
						last quality you crossed.
					</p>
					<p>
						While the loop plays, browsing stays silent. Select a slot, browse visually, then
						release a sweep or press <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd>
						to stage that quality for the slot's next arrival. The badge on the chord lets you keep it,
						or revert (also the first
						<kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Escape</kbd>) to restore the
						original harmony.
					</p>
					<p>
						While stopped, select a chord and pick a different root or quality: the chord settings
						panel offers <strong class="text-foreground">Replace</strong> to swap it in, keeping the
						chord's inversion, voicing, duration and octave.
					</p>
				</div>
			</section>

			<Separator />

			<section>
				<h3 class="text-base font-semibold mb-3">Shaping Chords</h3>

				<div class="space-y-4">
					<div>
						<h4 class="font-medium mb-1">Inversions</h4>
						<p class="text-muted-foreground">
							Change which chord tone sits in the bass. Inversions keep the same harmony while
							changing the movement and weight of the progression.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Voicings</h4>
						<p class="text-muted-foreground mb-2">
							Spread notes across different octaves for tighter or wider textures:
						</p>
						<ul class="space-y-1 ml-4 list-disc list-outside text-muted-foreground">
							<li><strong class="text-foreground">Close</strong> - Notes stacked tightly.</li>
							<li>
								<strong class="text-foreground">Open</strong> - Middle notes raised an octave.
							</li>
							<li>
								<strong class="text-foreground">Drop 2</strong> - Second-highest note dropped down.
							</li>
							<li>
								<strong class="text-foreground">Drop 3</strong> - Third-highest note dropped down.
							</li>
							<li>
								<strong class="text-foreground">Wide</strong> - Maximum spacing across octaves.
							</li>
						</ul>
					</div>

					<div>
						<h4 class="font-medium mb-1">Durations</h4>
						<p class="text-muted-foreground">
							Use the duration stepper to set each chord from 1/8 bar to 2 bars in 1/8-bar
							increments. Loop playback, the progress indicator, saved progressions, and MIDI export
							all use these timings.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Octave</h4>
						<p class="text-muted-foreground">
							Move a chord up or down by up to two octaves to find the register that fits your
							track.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Randomize</h4>
						<p class="text-muted-foreground">
							Randomize inversion and voicing by default. Use the settings button beside Randomize
							(or Settings → Randomize) to include octave or quality changes, or to turn any
							randomization type off. These settings persist in your browser.
						</p>
					</div>
				</div>
			</section>

			<Separator />

			<section>
				<h3 class="text-base font-semibold mb-3">Theory Helpers</h3>

				<div class="space-y-4">
					<div>
						<h4 class="font-medium mb-1">Key & Scale</h4>
						<p class="text-muted-foreground">
							Select a key and mode when you want guidance. Enable
							<strong class="text-foreground"> Highlight scale chords</strong> to dim out-of-scale options
							in the builder. All chords remain usable.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Randomize Within Scale</h4>
						<p class="text-muted-foreground">
							When a scale is selected, this option keeps randomized chord qualities inside the
							selected scale where possible.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Piano Keyboard</h4>
						<p class="text-muted-foreground">
							Toggle the piano icon to show the keyboard. It automatically sizes to your progression
							and highlights active notes during playback.
						</p>
					</div>
				</div>
			</section>

			<Separator />

			<section>
				<h3 class="text-base font-semibold mb-3">Saving & Exporting</h3>

				<div class="space-y-4">
					<div>
						<h4 class="font-medium mb-1">Chord Palette</h4>
						<p class="text-muted-foreground">
							Drag chords into the palette to collect ideas without committing them to the canvas.
							Palette chords can be previewed, deleted, reordered, or dragged back into a
							progression.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Saved Progressions</h4>
						<p class="text-muted-foreground mb-2">
							Click <strong class="text-foreground">Save</strong> when the canvas has at least two chords.
							Add a name and optional tags, then find the progression later from the Saved section.
						</p>
						<ul class="space-y-1 ml-4 list-disc list-outside text-muted-foreground">
							<li>Search saved progressions by name or tag.</li>
							<li>Preview a saved progression before loading it.</li>
							<li>Load a saved progression into the canvas.</li>
							<li>Export saved progressions directly to MIDI.</li>
						</ul>
					</div>

					<div>
						<h4 class="font-medium mb-1">MIDI Export</h4>
						<p class="text-muted-foreground">
							Click <strong class="text-foreground">Export MIDI</strong> to download a .mid file that
							uses your chord notes, voicings, octaves, and durations.
						</p>
					</div>
				</div>
			</section>

			<Separator />

			<section>
				<h3 class="text-base font-semibold mb-3">MIDI & DAW Sync</h3>

				<div class="space-y-4">
					<div>
						<h4 class="font-medium mb-1">MIDI Output</h4>
						<p class="text-muted-foreground mb-2">
							Use the cable icon to send playback to a DAW through a virtual MIDI port. When MIDI
							output is connected, preview uses your DAW instrument instead of the built-in piano.
							Channel, velocity and strum are in Settings → MIDI.
						</p>
						<ul class="space-y-1 ml-4 list-disc list-outside text-muted-foreground">
							<li><strong class="text-foreground">macOS:</strong> Enable IAC Driver.</li>
							<li>
								<strong class="text-foreground">Windows:</strong> Create a port with loopMIDI.
							</li>
							<li>
								<strong class="text-foreground">DAW:</strong> Select the virtual port as MIDI input and
								arm the track.
							</li>
						</ul>
						<p class="text-muted-foreground mt-2 text-xs">
							Use a browser with Web MIDI support, such as Chrome, Edge, or Opera. Safari is not
							supported.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">DAW Sync</h4>
						<p class="text-muted-foreground">
							Enable Clock Sync in Settings → MIDI to follow MIDI Clock tempo and DAW start/stop
							transport. When clock is actively received, the DAW controls playback and the app
							displays the detected BPM.
						</p>
					</div>
				</div>
			</section>

			<Separator />

			<section>
				<h3 class="text-base font-semibold mb-3">Workflow Tips</h3>

				<div class="space-y-3">
					<div>
						<h4 class="font-medium mb-1">Experiment Freely</h4>
						<p class="text-muted-foreground">
							The scale tools are helpers, not gates. Try the chord that looks wrong if it sounds
							right.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Use Space Intentionally</h4>
						<p class="text-muted-foreground">
							Add empty slots or varied durations to create pauses, pushes, and uneven harmonic
							rhythm.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Loop Small Changes</h4>
						<p class="text-muted-foreground">
							Loop the progression while adjusting inversion, voicing, octave, and duration. Small
							moves can change the feel dramatically.
						</p>
					</div>
				</div>
			</section>

			<Separator />

			<section>
				<h3 class="text-base font-semibold mb-3">Keyboard Shortcuts</h3>

				<div class="space-y-4">
					<div>
						<h4 class="font-medium mb-2">Playback & Surfaces</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd></span>
							<span>Play or stop instantly</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Escape</kbd></span>
							<span>
								Revert audition, close inspector, close library, close popover or modal, then stop.
								One layer closes per press.
							</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Cmd/Ctrl + S</kbd></span>
							<span>Save progression</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Cmd/Ctrl + E</kbd></span>
							<span>Export MIDI</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">?</kbd></span>
							<span>Open this help</span>
						</div>
					</div>

					<div>
						<h4 class="font-medium mb-2">Chord Builder</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Tab</kbd></span>
							<span>Move through controls in normal page order</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">← / →</kbd></span>
							<span>Move within the focused root or quality row</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">↓</kbd></span>
							<span>Move from the root row into qualities</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">↑</kbd></span>
							<span>From the top quality row, return to roots</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd></span>
							<span>While playing, stage the visually browsed quality</span>
						</div>
						<p class="mt-2 text-xs text-muted-foreground">
							Arrow moves select and preview while stopped. During playback they move only the
							visual browse cursor until you press Enter.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-2">Progression Slots</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">1-9</kbd></span>
							<span>Select a slot and open its inspector</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd></span>
							<span>Add the ready chord, or replace the selected slot</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">R</kbd></span>
							<span>Replace the selected slot with the ready chord</span>
						</div>
					</div>
				</div>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
