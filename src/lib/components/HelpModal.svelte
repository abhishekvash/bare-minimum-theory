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
						<strong class="text-foreground">Choose a quality</strong> - Click to preview, or drag to
						add the chord.
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
							Randomize inversion and voicing by default. Open the settings button beside Randomize
							to include octave or quality changes, or to turn any randomization type off. These
							settings persist in your browser.
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
							Enable Clock Sync in the MIDI setup modal to follow MIDI Clock tempo and DAW
							start/stop transport. When clock is actively received, the DAW controls playback and
							the app displays the detected BPM.
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
						<h4 class="font-medium mb-2">Playback & Export</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd></span>
							<span>Play or stop</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Escape</kbd></span>
							<span>Stop playback or close modals</span>
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
							<span>Switch root and quality focus</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Arrow Keys</kbd></span>
							<span>Navigate the focused grid</span>
						</div>
					</div>

					<div>
						<h4 class="font-medium mb-2">Progression Slots</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Number Keys</kbd></span>
							<span>Focus a slot and preview its chord</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd></span>
							<span>Add the selected builder chord</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">R</kbd></span>
							<span>Replace the focused slot</span>
						</div>
					</div>
				</div>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
