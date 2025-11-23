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
				<p class="text-muted-foreground mb-3">
					Build any chord progression in three simple steps:
				</p>
				<ol class="space-y-2 ml-4 list-decimal list-outside text-muted-foreground">
					<li><strong class="text-foreground">Pick a root note</strong> – Click any note (C, D, E, etc.)</li>
					<li><strong class="text-foreground">Choose a quality</strong> – Click to preview, drag to add (Major, minor, 7th, etc.)</li>
					<li><strong class="text-foreground">Drop into progression</strong> – Drag chords into the 4 slots below</li>
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

					<!-- Voicings -->
					<div>
						<h4 class="font-medium mb-1">Voicings</h4>
						<p class="text-muted-foreground mb-2">
							Spread chord notes across different octaves for richer sounds:
						</p>
						<ul class="space-y-1 ml-4 list-disc list-outside text-muted-foreground">
							<li><strong class="text-foreground">Close</strong> – Notes stacked tightly</li>
							<li><strong class="text-foreground">Open</strong> – Middle notes raised an octave</li>
							<li><strong class="text-foreground">Drop 2</strong> – Second-highest note dropped down</li>
							<li><strong class="text-foreground">Drop 3</strong> – Third-highest note dropped down</li>
							<li><strong class="text-foreground">Wide</strong> – Maximum spacing across octaves</li>
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
							Instantly randomize a chord's quality, inversion, and voicing. Enable "Randomize
							within scale" in the Scale Filter to keep variations in key.
						</p>
					</div>

					<!-- Scale Filter -->
					<div>
						<h4 class="font-medium mb-1">Scale Filter (Optional)</h4>
						<p class="text-muted-foreground">
							Select a key and mode to highlight in-scale chords. This is a helper, not a
							restriction – you can still use any chord you want. Enable "Highlight scale chords"
							to dim out-of-scale options in the builder.
						</p>
					</div>

					<!-- Palette -->
					<div>
						<h4 class="font-medium mb-1">Chord Palette</h4>
						<p class="text-muted-foreground">
							Save interesting chords to your palette for quick access later. Drag chords to the
							palette, rename them, and drag them back into your progression anytime. Perfect for
							collecting ideas while exploring.
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
							Use the play button to loop your progression at 120 BPM. Listen for flow, tension,
							and resolution. Small changes to inversions or voicings can dramatically affect the
							feel.
						</p>
					</div>
				</div>
			</section>

			<Separator />

			<!-- Keyboard Shortcuts -->
			<section>
				<h3 class="text-base font-semibold mb-3">Keyboard Shortcuts</h3>
				<p class="text-muted-foreground italic">Coming soon – stay tuned!</p>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
