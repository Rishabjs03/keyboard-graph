# Switch sound sources

Every switch profile is cut from a real recording of a mechanical keyboard. All four
recordings are released under **Creative Commons 0** (public domain dedication,
https://creativecommons.org/publicdomain/zero/1.0/), so they can be copied, modified
and redistributed, commercially included, without asking permission. Attribution is
not required, but the recordists deserve the credit:

| Profile | Switch                                                                       | Recording                            | Recordist   | Source                                                  |
| ------- | ---------------------------------------------------------------------------- | ------------------------------------ | ----------- | ------------------------------------------------------- |
| `blue`  | Kailh Box Jade (clicky)                                                      | "Kailh Box Jade Switches Sound"      | el_boss     | https://freesound.org/people/el_boss/sounds/643558/     |
| `brown` | Cherry MX Brown on a Kinesis Advantage (tactile)                             | "Kinesis Cherry MX Brown Typing.wav" | DarcyConroy | https://freesound.org/people/DarcyConroy/sounds/249889/ |
| `red`   | Linear switches, tagged "clack"                                              | "keyboard2.wav"                      | samchitto   | https://freesound.org/people/samchitto/sounds/696040/   |
| `cream` | A thocky custom keyboard (stand-in: no CC0 NovelKeys Cream recording exists) | "Thocky Keyboard Typing (No Spaces)" | aliyahb     | https://freesound.org/people/aliyahb/sounds/869165/     |

Each licence was checked on the sound's Freesound page on 2026-10-05.

## How the sprites were made

`scripts/slice-recordings.py` (Python 3 + numpy + ffmpeg) detects every keystroke in a
recording, pairs each press with the quieter release that follows it, keeps only clean,
isolated strokes with a sharp onset and a consistent tone, normalises them (releases
keep their natural level, capped at 55% of the press) and packs 6 presses + 4 releases
per profile into one 96 kbps mono MP3 sprite (`<profile>.mp3`) with stroke offsets in
`<profile>.json`. `scripts/encode-sounds.mjs` then embeds each sprite as a lazily
loaded module under `src/audio/sounds/`.

```bash
python3 scripts/slice-recordings.py blue sounds path/to/recording.mp3
pnpm --filter clacky sounds
```
