export const load = async ({ url }) => {
  return {
    title: 'Bare Minimum Theory - Chord Progression Builder',
    description:
			'Build chord progressions without music school. Free browser-based tool for self-taught producers. Preview audio, export MIDI, learn by doing.',
    keywords:
			'chord progression, music theory, midi export, chord builder, self-taught musician, bedroom producer, music production, chord generator',
    siteName: 'Bare Minimum Theory',
    imageURL: `${url.origin}/og-image.png`,
    author: 'Abhishek S',
    type: 'website'
  }
}
