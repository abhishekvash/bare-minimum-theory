<script lang="ts">
	import ChevronDown from 'lucide-svelte/icons/chevron-down';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// Detect platform
	let platform = $derived.by(() => {
		if (typeof navigator === 'undefined') return 'unknown';
		const ua = navigator.userAgent.toLowerCase();
		if (ua.includes('mac')) return 'macos';
		if (ua.includes('win')) return 'windows';
		if (ua.includes('linux')) return 'linux';
		return 'unknown';
	});

	let instructions = $derived.by(() => {
		switch (platform) {
			case 'macos':
				return {
					title: 'macOS Setup (IAC Driver)',
					steps: [
						'Open "Audio MIDI Setup" (search in Spotlight)',
						'Go to Window → Show MIDI Studio',
						'Double-click "IAC Driver"',
						'Check "Device is online"',
						'Click Apply, then close',
						'In your DAW, select IAC Driver as MIDI input'
					]
				};
			case 'windows':
				return {
					title: 'Windows Setup (loopMIDI)',
					steps: [
						'Download loopMIDI from tobias-erichsen.de/software/loopmidi.html',
						'Install and run loopMIDI',
						'Click the "+" button to create a virtual MIDI port',
						'Name it something like "BMT to DAW"',
						'In your DAW, select the loopMIDI port as MIDI input'
					]
				};
			case 'linux':
				return {
					title: 'Linux Setup',
					steps: [
						'Install a virtual MIDI loopback driver',
						'Create a virtual MIDI port using ALSA or JACK',
						'Connect the virtual port to your DAW'
					]
				};
			default:
				return {
					title: 'Setup Required',
					steps: ['You need a virtual MIDI port to route audio to your DAW']
				};
		}
	});
</script>

<details bind:open class="group">
	<summary class="flex items-center gap-2 cursor-pointer list-none">
		<ChevronDown class="size-4 transition-transform group-open:rotate-180" />
		<span class="font-medium">{instructions.title}</span>
	</summary>
	<ol class="mt-3 ml-6 space-y-1.5 list-decimal list-outside text-muted-foreground">
		{#each instructions.steps as step, i (i)}
			<li>{step}</li>
		{/each}
	</ol>
</details>
