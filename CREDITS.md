# Credits

## Piano samples (app/audio/piano/)

- Source: "Salamander Grand Piano V3" by Alexander Holm (a Yamaha C5 grand piano, close-miked), as published
  in the Tone.js sample set at https://tonejs.github.io/audio/salamander/ (originally https://archive.org/details/SalamanderGrandPianoV3).
- Licence: Creative Commons Attribution 3.0 (CC-BY 3.0), https://creativecommons.org/licenses/by/3.0/
- Attribution: piano samples by Alexander Holm, Salamander Grand Piano, CC-BY 3.0.
- Changes made at build time (tools/piano-samples/build.mjs, receipt tools/piano-samples/sources.json): all 25 keys, C3 to C5 (octave 3 and octave 4 plus C5), are made from the
  nearest recorded Salamander note (the set has C, D#, F#, A in every octave), moved by at most one semitone, converted to mono, trimmed to 3 seconds, faded out and
  level-matched, then encoded as 64 kbps mp3. Each file's source and output checksums are in the receipt. This note is the required "indicate changes" statement.

## Sound effects (app/audio/*.mp3)

- Kenney sound packs, CC0 (public domain). See assets3d/LICENSES.md.

## Voice (app/audio/voice/)

- Recorded with the project's own ElevenLabs account (voice "Carlotta"); no third-party recordings.
