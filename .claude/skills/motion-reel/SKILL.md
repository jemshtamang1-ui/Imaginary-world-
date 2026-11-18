---
name: motion-reel
description: Produce premium, "studio-grade" motion-graphics videos entirely in code: dreamy 3D cloudscapes, floating 3D props, frosted-glass UI, serif-plus-grotesk kinetic typography, cuts timed to a voice-over, synthesized score and sound design, rendered frame-by-frame in headless Chromium to a 60 fps MP4. Use this skill whenever the user asks for a promo video, product reel, launch video, explainer, ad, Instagram/TikTok/Reels clip, "make a video like this", motion graphics, kinetic type, a 3D animated video, or wants to turn a script or voice-over into a polished video, even if they never say "motion graphics" and even if they only share a reference clip and ask for something "in this style".
---

# Motion reel

Make videos that look like a top motion studio made them, using only code: Three.js for the 3D world, DOM for type and UI, deterministic frame-by-frame rendering, ffmpeg for the encode. The bundled `template/` is a working engine built this way; start from it rather than from scratch.

## What "this style" means

The look is calm, airy and expensive, and the edit is fast. Hold both at once.

- **A world, not a slide deck.** Everything happens inside one continuous 3D environment (default: a sunlit cloud sea with towering cumulus). The camera is always moving: slow dolly, crane or orbit, never a locked-off frame. Cuts teleport the camera to a new spot in the same world, so the film feels like one place.
- **Layers with depth, back to front:** sky gradient and sun glow, then the cloud sea and floor, then cumulus cards, then floating 3D props, then frosted-glass UI, then type, then a post grade (bloom, vignette, subtle grain). Depth sells quality more than any single asset.
- **Light tells time.** Grade the film as a time-of-day arc: cool morning, clear midday, soft "dream" pastel, golden hour for the payoff. One contrasting beat (for example a dark space shot with a planet limb) makes the brightness feel deliberate.
- **Type is a duet.** A small, clean grotesk (`Inter`, 46–64px) sets up the line; a huge italic high-contrast serif (`Instrument Serif`, 140–300px) lands the key word. Heavy grotesk (`Inter Tight` 800) is for numbers and calls to action. One accent colour (coral `#FF6A40`) marks the single most important word in a beat. Never more than one accent word per beat.
- **Words arrive on the voice.** Each word appears within about 50ms of being spoken: blur `16px→0`, rise `26px→0`, opacity `0→1`, expo-out over `0.55s`. Groups leave by blurring up and away. Key punches ("heck!", "Enter.", "Free.") scale in from `1.35×`.
- **Glass UI as a character.** Prompt bars, render progress pills, comment cards: white at 50–55% opacity, `backdrop-filter: blur(26px) saturate(1.5)`, 1.5px white border, big radius, soft long shadow. Animate them like objects: rise in, type into them, press the send button.
- **3D props that do something.** A laptop whose screen is a live canvas, a paper card that spins in, cards that erupt and swarm past the camera, an icon that cracks along real fracture lines and shatters into shards. Each prop gets an entrance, a moment and an exit.
- **Fast flow.** A new visual idea every 1–3 seconds. Transitions hide cuts: white or cream flash bursts, whip pans (directional blur), zoom-blur rushes, foreground cloud wipes, a CRT collapse into darkness. Put an impact (flash, shake, zoom, sub hit) on every big word.
- **Originality.** Invent original brands, products, mascots and characters for demo content. Never recreate someone else's characters, logos or trademarked designs, even when the user's reference video uses them. Remake the style, not the assets. If the user wants a close copy of someone else's reel, steer toward their own wording and visuals.

## Workflow

Work in this order. Each step has a cheap feedback loop, so problems surface before the expensive render.

### 1. Lock the words and their timings

The voice-over is the clock for the whole edit.

- If the user has a VO file, convert it and force-align it to the script to get per-word timings: `ffmpeg -i vo.mp3 -ac 1 -ar 16000 vo16.wav`, then `python3 -I scripts/align.py vo16.wav script.txt words.json` (needs `pip install pocketsphinx`; its model ships in the wheel, so this works offline). Add pronunciations for unusual words; the script lists any it can't find. Cross-check pauses with `ffmpeg -af silencedetect=noise=-38dB:d=0.18`.
- If there's no VO yet, write the script, give the user the exact text to paste into their TTS tool (with `<break time="0.6s" />` pauses at section changes), and wait for the audio. Don't build to guessed timings.
- Total length is the VO length plus a `0.5–0.8s` tail.

### 2. Shot plan

Write a shot list before any code: start and end time, the words covered, camera move, props, type layout, palette, and the transition into the next shot. Cut on consonants and at section breaks. Aim for 10–16 shots in 45 seconds. Plan where each piece of type sits so it never fights a prop: text left and props right, or text top and props centre.

### 3. Set up the engine

Copy `template/` into a project directory and run `npm install`. Also needed: a global `playwright` with Chromium, `ffmpeg`, and Python with `numpy` and `Pillow`. Then start `node server.mjs 8123`.

- Bake the cloud cards once: `node tools/tools_bake.cjs` (12 textures, about 3–4 minutes in software GL), then `python3 -I scripts/pack_atlas.py assets`, then generate foreground wipe clouds (see `references/engine.md`).
- `src/director.js` is a worked example from a previous film. Keep its structure (shot objects with `cam`, `run` and `fx`; global transition effects; text specs) and replace its content with your shot plan.
- Read `references/engine.md` before changing anything in the renderer. It explains the pipeline and the failure modes that cost hours last time.

### 4. Build and review in stills, constantly

Render review frames with `node tools/tools_frames.cjs 0.6,4.2,7.9,... work/review/fr_` and tile them into a contact sheet (`ffmpeg` `hstack`/`vstack` or `tile`). Look at them every time you change something. Check these on every pass:

- **Legibility:** can every word be read against what's behind it? White text over bright cloud is the most common failure. The template gives each text group a feathered scrim (navy on blue sky, warm brown at golden hour) plus layered shadows; keep them.
- **Collisions:** does text overlap a prop or UI element? Move the prop, not the text.
- **Air:** is the frame washed out (fog too dense, camera inside cloud, sky not visible)? Lift the camera and look slightly up, so the sky carries the type.
- **Transitions:** sample a frame just before and after every cut.
- **Glare and artifacts:** environment reflections on screens, z-fighting, stray objects left visible.

Fix, re-render those frames, and repeat. Frames cost about 1–2s each, so iterate freely here rather than after the full render.

### 5. Sound

Use `sound.py`, which synthesizes an original score and SFX from scratch and mixes them under the VO; see `references/sound.md`. Measure the balance rather than guessing: the voice should sit 8–14 dB above the bed in the speech band. If the user supplies music, mix it instead of the synth score, and keep the SFX timing.

### 6. Full render, encode, QA

`scripts/render.sh <duration> work/mix.wav 3 60` renders with parallel workers, normalizes the audio to `-14 LUFS` and writes `out.mp4` (master, CRF 16) and `out-small.mp4` (preview, CRF 22). A 46s film takes about 30–40 minutes on 4 CPU cores. Afterwards, make a contact sheet from the encoded MP4 itself (`fps=0.6,tile=4x7`) and inspect it before sending. If a problem is local, re-render only that frame range and re-encode.

Deliver the preview and the master, and offer the SFX-only stem (`STEM=sfx python3 sound.py ...`) and a 9:16 cut.

## Quality bar

Before calling it done, check:

- Every word on screen appears on its spoken word, and nothing on screen contradicts the VO.
- Every frame has camera motion and at least two depth layers.
- Every shot has one clear focal point, and the accent colour is used once per beat.
- All text is readable at phone size (check a 640px-wide contact sheet).
- Cuts are hidden or motivated by a flash, whip, wipe or rush; there are no unexplained jumps.
- Props enter, do something, and exit.
- **Sound:** an impact on every punch word, a whoosh on every cut, a riser into every big reveal, typing under every typed line; the voice stays on top.
- Brands, products and characters are all invented or the user's own.

## Reference files

- `references/engine.md`: pipeline architecture, performance numbers, and the gotchas list. Read before touching the renderer.
- `references/sound.md`: score, SFX vocabulary, mix targets and how to measure them.
- `template/`: the engine (Three.js world, post, props, glass UI, text system, example director, sound synth, render tools).
- `scripts/`: `align.py` (VO word timings), `pack_atlas.py`, `render.sh`.
