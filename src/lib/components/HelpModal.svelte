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
				Learn how to build chord progressions with Bare Minimum Theory
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 text-sm">
			<!-- Getting Started -->
			<section>
				<h3 class="text-base font-semibold mb-3">Getting Started</h3>
				<p class="text-muted-foreground mb-3">Build any chord progression in three simple steps:</p>
				<ol class="space-y-2 ml-4 list-decimal list-outside text-muted-foreground">
					<li>
						<strong class="text-foreground">Pick a root note</strong> – Click any note (C, D, E, etc.)
					</li>
					<li>
						<strong class="text-foreground">Choose a quality</strong> – Click to preview, drag to add
						(Major, minor, 7th, etc.)
					</li>
					<li>
						<strong class="text-foreground">Build your progression</strong> – Drag chords into the
						canvas below. Add slots with the <strong class="text-foreground">+</strong> button, or insert
						between chords by hovering.
					</li>
				</ol>
				<p class="text-muted-foreground mt-3">
					Your last selection stays active, making it easy to add multiple chords quickly.
				</p>
			</section>

			<Separator />

			<!-- Features -->
			<section>
				<h3 class="text-base font-semibold mb-3">Features</h3>

				<div class="space-y-4">
					<!-- Inversions -->
					<div>
						<h4 class="font-medium mb-1">Inversions</h4>
						<p class="text-muted-foreground">
							Change which note is in the bass. Each inversion cycles through the chord tones,
							creating different voicings while keeping the same harmony. Perfect for smooth bass
							lines and varied textures.
						</p>
					</div>

					<!-- Durations -->
					<div>
						<h4 class="font-medium mb-1">Chord Durations</h4>
						<p class="text-muted-foreground">
							Set precise lengths for each chord using the <strong class="text-foreground"
								>+/-</strong
							> stepper. Choose from 16 duration options ranging from 1/8 bar to 2 bars in 1/8 bar increments
							(1/8, 1/4, 3/8, 1/2, 5/8, 3/4, 7/8, 1, 1+1/8, 1+1/4, 1+1/2, 1+3/4, and 2 bars). The playback
							engine and MIDI export will respect these durations, allowing for complex rhythms and harmonic
							pacing.
						</p>
					</div>

					<!-- Voicings -->
					<div>
						<h4 class="font-medium mb-1">Voicings</h4>
						<p class="text-muted-foreground mb-2">
							Spread chord notes across different octaves for richer sounds:
						</p>
						<ul class="space-y-1 ml-4 list-disc list-outside text-muted-foreground">
							<li><strong class="text-foreground">Close</strong> – Notes stacked tightly</li>
							<li><strong class="text-foreground">Open</strong> – Middle notes raised an octave</li>
							<li>
								<strong class="text-foreground">Drop 2</strong> – Second-highest note dropped down
							</li>
							<li>
								<strong class="text-foreground">Drop 3</strong> – Third-highest note dropped down
							</li>
							<li>
								<strong class="text-foreground">Wide</strong> – Maximum spacing across octaves
							</li>
						</ul>
					</div>

					<!-- Octave Transpose -->
					<div>
						<h4 class="font-medium mb-1">Octave Transpose</h4>
						<p class="text-muted-foreground">
							Move chords up or down by octaves (±2 octaves) to find the perfect register for your
							progression.
						</p>
					</div>

					<!-- Randomize -->
					<div>
						<h4 class="font-medium mb-1">Randomize</h4>
						<p class="text-muted-foreground">
							Instantly randomize a chord's inversion and voicing while keeping the chord itself.
							Click the <strong class="text-foreground">gear icon</strong> next to Randomize to configure
							what gets randomized (inversion, voicing, octave, or quality). Your settings are saved
							automatically.
						</p>
					</div>

					<!-- Scale Filter -->
					<div>
						<h4 class="font-medium mb-1">Scale Filter (Optional)</h4>
						<p class="text-muted-foreground">
							Select a key and mode to highlight in-scale chords. This is a helper, not a
							restriction – you can still use any chord you want. Enable "Highlight scale chords" to
							dim out-of-scale options in the builder.
						</p>
					</div>

					<!-- Palette -->
					<div>
						<h4 class="font-medium mb-1">Chord Palette</h4>
						<p class="text-muted-foreground">
							Save interesting chords to your palette for quick access later. Drag chords to the
							palette and drag them back into your progression anytime. Perfect for collecting ideas
							while exploring.
						</p>
					</div>

					<!-- Saved Progressions -->
					<div>
						<h4 class="font-medium mb-1">Saved Progressions</h4>
						<p class="text-muted-foreground mb-2">
							Save your complete progressions to come back to them later. Click the
							<strong class="text-foreground">Save</strong> button (requires at least 2 chords) to save
							with a name and optional tags.
						</p>
						<ul class="space-y-1 ml-4 list-disc list-outside text-muted-foreground">
							<li>Search saved progressions by name or tag</li>
							<li>Preview audio before loading</li>
							<li>Load into canvas (replaces current progression)</li>
							<li>Export directly to MIDI from saved list</li>
						</ul>
					</div>

					<!-- Piano Keyboard -->
					<div>
						<h4 class="font-medium mb-1">Piano Keyboard</h4>
						<p class="text-muted-foreground">
							Toggle the visual piano keyboard using the
							<strong class="text-foreground">piano icon</strong> next to the Play button. The keyboard
							displays currently playing notes with animated dots during playback, automatically adjusting
							its range to fit your progression.
						</p>
					</div>

					<!-- MIDI Output -->
					<div>
						<h4 class="font-medium mb-1">MIDI Output to DAW (Beta)</h4>
						<p class="text-muted-foreground mb-2">
							Preview progressions with your own sounds instead of the built-in piano. Click the
							<strong class="text-foreground">cable icon</strong> next to the Play button to enable MIDI
							output.
						</p>
						<p class="text-muted-foreground mb-2">
							<strong class="text-foreground">One-time setup required:</strong>
						</p>
						<ul class="space-y-1 ml-4 list-disc list-outside text-muted-foreground">
							<li>
								<strong class="text-foreground">macOS:</strong> Enable IAC Driver in Audio MIDI Setup
							</li>
							<li>
								<strong class="text-foreground">Windows:</strong> Download loopMIDI and create a virtual
								port
							</li>
							<li>
								<strong class="text-foreground">DAW:</strong> Select the virtual port as MIDI input and
								arm the track
							</li>
						</ul>
						<p class="text-muted-foreground mt-2 text-xs">
							Note: Safari is not supported. Use Chrome, Firefox, or Edge.
						</p>
					</div>

					<!-- DAW Sync -->
					<div>
						<h4 class="font-medium mb-1">DAW Sync (MIDI Clock)</h4>
						<p class="text-muted-foreground mb-2">
							Sync playback tempo and transport with your DAW. When enabled, the app listens for
							MIDI Clock messages from your DAW to:
						</p>
						<ul class="space-y-1 ml-4 list-disc list-outside text-muted-foreground">
							<li>Match your DAW's tempo automatically</li>
							<li>Start/stop playback when you press play/stop in your DAW</li>
						</ul>
						<p class="text-muted-foreground mt-2">
							Enable in the MIDI setup modal under <strong class="text-foreground"
								>Clock Sync</strong
							>. Select your DAW's MIDI output as the clock source.
						</p>
					</div>
				</div>
			</section>

			<Separator />

			<!-- Workflow Tips -->
			<section>
				<h3 class="text-base font-semibold mb-3">Workflow Tips</h3>

				<div class="space-y-3">
					<div>
						<h4 class="font-medium mb-1">Experiment Freely</h4>
						<p class="text-muted-foreground">
							All music theory constraints are optional. Don't be afraid to try "wrong" chords –
							beautiful discoveries often come from breaking the rules.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Use the Palette for Ideation</h4>
						<p class="text-muted-foreground">
							When exploring, save chords to your palette as you go. This lets you collect ideas
							without committing to a progression, then mix and match later.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Save Your Work</h4>
						<p class="text-muted-foreground">
							Found a progression you like? Save it with a name and tags so you can come back to it
							later. Your saved progressions persist across browser sessions.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Export to Your DAW</h4>
						<p class="text-muted-foreground">
							Click "Export MIDI" to download your progression as a .mid file. Import it into any
							DAW (Ableton, Logic, FL Studio, etc.) to continue production with your favorite
							instruments and effects.
						</p>
					</div>

					<div>
						<h4 class="font-medium mb-1">Loop & Listen</h4>
						<p class="text-muted-foreground">
							Use the play button to loop your progression. The timing adjusts dynamically based on
							your chord durations. Listen for flow, tension, and resolution. Small changes to
							inversions or voicings can dramatically affect the feel.
						</p>
					</div>
				</div>
			</section>

			<Separator />

			<!-- Keyboard Shortcuts -->
			<section>
				<h3 class="text-base font-semibold mb-3">Keyboard Shortcuts</h3>

				<div class="space-y-4">
					<div>
						<h4 class="font-medium mb-2">Playback & Export</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd></span>
							<span>Play/Stop toggle</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Escape</kbd></span>
							<span>Stop playback / Close modals</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">⌘/Ctrl + S</kbd></span>
							<span>Save progression</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">⌘/Ctrl + E</kbd></span>
							<span>Export MIDI</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">?</kbd></span>
							<span>Open this help</span>
						</div>
					</div>

					<div>
						<h4 class="font-medium mb-2">Chord Builder</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Tab</kbd></span>
							<span>Switch Root ↔ Quality grid</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Arrow Keys</kbd></span>
							<span>Navigate within grid</span>
						</div>
					</div>

					<div>
						<h4 class="font-medium mb-2">Progression Slots</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Number Keys</kbd></span>
							<span>Focus slot + preview chord</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd></span>
							<span>Add chord (or replace focused slot)</span>
							<span><kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">R</kbd></span>
							<span>Replace focused slot</span>
						</div>
					</div>
				</div>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
