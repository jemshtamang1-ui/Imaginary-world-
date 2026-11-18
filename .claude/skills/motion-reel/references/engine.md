# Engine reference

Read this before changing the renderer. Everything here was learned the hard way.

## Pipeline

```
director.js ──► main.js renderAt(t) ──► WebGL canvas (world + props, post)   ┐
  shots/fx/       │                    ├► #ui    glass UI (DOM)              ├─► page.screenshot ─► ffmpeg
  texts/cues      │                    ├► #type  kinetic type (DOM)          │   (render_worker.cjs)
                  │                    ├► #wipe  foreground cloud wipes      │
                  │                    └► #grain #vignette #flash overlays   ┘
                  └► __cues() ─► export_cues.cjs ─► work/cues.json ─► sound.py ─► work/mix.wav
```

* **Deterministic.** `window.__render(t)` sets *every* visual from `t` alone: no clocks, no CSS
  transitions/animations, no `Math.random()` (use `rng(seed)` / `drift()` from `lib.js`). Any frame can be
  rendered in any order by any worker, and re-rendering a range gives identical pixels.
* **Layers, back to front:** sky sphere (`world.js` SKY_FS, sun disk and glow, stars in space) → cloud sea
  plane (fbm shading, distance fog) → cumulus + sea-puff cards (one instanced mesh of camera-facing
  cards sampling the baked atlas, sorted back to front on the CPU every frame) → props (lit by sun and hemi
  light + RoomEnvironment) → post (bloom, whip/zoom blur, CA, contrast/saturation grade, Neutral tone map)
  → DOM glass UI → DOM type → DOM wipes → grain/vignette/flash.
* **Camera.** `shot.cam(lt, sp, t)` returns `{pos, look, fov, roll, handheld}`; main adds handheld drift.
  World units are roughly metres: sea at y=0, cumulus 1–3.7 km tall, camera at 130–330 m.
* **Props live in a near rig.** Use `ctx.near(x, y, z)` (x right, y up, z negative = in front), not world
  coordinates. Cameras travel hundreds of units for cloud parallax while props sit about 10 units away; a
  prop anchored in world space gets flown past in half a second. `near()` rides with the current camera
  and slides back by `parallax` (default 0.012) of the camera's travel since the shot started.
* **Palettes** (`palettes.js`) are blended per shot: `palette: 'midday'`, `['dream','golden']` (blend across
  the shot, optional `paletteEase`), or a function `(sp, lt) => paletteObject`. `scrim` sets the type
  scrim/shadow colour; `sat`/`contrast` set the grade.
* **fx** (`fx.js`) are global and time-based, so they can straddle cuts: `flash` (centred on t),
  `whip` (dir, amount px), `rush` (zoom blur), `wipe` (foreground cloud bank fully covering at t),
  `shake`, `punch`, `crt` (collapse to line → dot over dur, then black for `hold`), `dark` (hold black
  for dur, then fade up over `fade`), `fadeout`. Whips also blur type/UI with an SVG directional blur.
* **Text** (`text.js`): markup and timing rules are in the file header. Each displayed word binds, in
  order, to the next matching word in `words.json`, so type lands on the voice automatically. A mismatch
  throws with context; fix the text or the script, don't hand-tune times.
* **Sound cues** come from three places: `cues` in the director (`t` is always the moment the sound
  *hits*: a riser's `t` is the reveal it lands on; typing's `t` is its start), a whoosh for every
  whip/rush/wipe and a power-down for every crt, and an impact for every `^punch` word.

## Commands

```bash
npm install && node server.mjs 8123 &          # serve the project (keep running)
node tools/tools_bake.cjs                       # 12 cloud cards -> assets/cloud_XX.png
python3 -I ../scripts/pack_atlas.py assets      # -> assets/clouds_atlas.png/.json
python3 -I ../scripts/make_wipes.py assets      # -> assets/wipe_0..2.png (foreground cloud wipes)
node tools/tools_frames.cjs 0.5,2.7,5.1 work/review/fr_      # review stills
python3 -I ../scripts/contact.py work/sheet.png --w 640 --cols 3 work/review/fr_*.png
node tools/export_cues.cjs && python3 -I sound.py work/cues.json [--vo vo.wav]
bash ../scripts/render.sh 14.6 work/mix.wav 3 60                  # full render -> out.mp4, out-small.mp4
```
(`new_project.sh` symlinks the skill's `scripts/` into the project, so inside a project use `scripts/...`; inside `template/` itself use `../scripts/...`.)
Preview interactively at `http://localhost:8123/?t=5` (space pauses, arrows seek 1 s, `,` `.` step a frame).

## Performance (4-core container, SwiftShader, 1920×1080)

* Cloud bake: about 1.5 s per card, 20 s for all 12.
* Review still: 0.9–1.3 s each in one browser (page load about 4 s, paid once per tools_frames call).
* Full render: about 1.2 s per frame per worker with 3 workers on 4 cores, so roughly 2.5 frames/s total.
  A 15 s film at 60 fps is about 6 min; 46 s is about 18–20 min. More workers than cores-1 is slower.
* Cost centres: the sea shader (three fbm evaluations per pixel), bloom mips, the 24-tap blur pass during
  whips/rushes, and large CSS blur filters on type. Exit and entrance blurs are short, so they're fine.

## Gotchas (each cost real time)

1. **Props flown past.** See the near rig above. If a prop is missing, project its position with the
   camera: NDC z > 1 means it's behind the camera.
2. **CRT left the film black.** An effect that "holds" must end. `crt` holds black only for `hold`
   (0.08 s); chain a `dark` effect for longer, and fade up with `fade`.
3. **Text ghosting through transitions.** A group's exit takes 0.45 s after `out`. Set `out` so the
   exit finishes *before* the next flash/CRT/dark peaks, or the old words show through the transition.
4. **Word spacing collapsed** ("Whatifthesky"). Flex `gap` in `em` resolves against the line's font-size
   (16 px), not the words'. Spacing is a per-word `margin-right` in em (style.css).
5. **Fonts must be loaded before `text.layout()`**: measuring with fallback fonts misplaces the scrims.
   main.js awaits `document.fonts.load()` for every face; add new faces there.
6. **Golden hour looked muddy** because the sun was off-screen: backlit clouds show their shadow side.
   Put the sun in or near frame (`sunAz` toward the camera's look direction, about 190° for cameras
   looking down −z, low `sunEl`), raise `glow`, and lean on the `silver` rim and the grade.
7. **Shake showed black frame edges.** The `shake` effect overscans (`scale *= 1 + a*0.0035`); keep that
   if you add new transform effects.
8. **Hard-edged glow planes** read as flat coloured squares once neighbours move. Use radial-gradient
   textures and fade them out within the first ~10% of the motion that reveals them.
9. **Camera inside a sea puff** gives a white blob in the foreground. Cards fade out as the camera gets
   within 0.35–0.9× their size (`vNear`), but keep shot cameras above about 130 m or move them laterally.
10. **Riser misplaced.** Sound cue times mark the *hit*. sound.py offsets every sound by its own
    peak (whoosh peaks at 60% of its duration, a riser at its end).
11. **WebGL in headless Chromium** needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`
    (tools/lib.cjs). Without them the canvas is blank or WebGL context creation fails.
12. **Screens with glare.** Laptop screens use `MeshBasicMaterial` (`toneMapped: false`) so the
    environment map never reflects on them.
13. **Atlas colour space.** The cloud atlas holds data (lighting/alpha), not colour: `NoColorSpace`.
    Palette hex values go through `THREE.Color`, which converts them to linear.

## Re-rendering a range

```bash
bash ../scripts/render.sh 14.6 none 1 60 1920 1080 480 560     # frames 480..559 -> work/segs/patch_480_560.mp4
```
Then splice: cut `work/video.mp4` around the range with `-ss/-to` (frame-accurate, re-encode at CRF 6),
concat the patch in between, and re-run the final encode lines from render.sh. For anything bigger than a
few seconds, a full re-render is simpler.

## 9:16 cut

Render with `w=1080 h=1920` (`render.sh ... 60 1080 1920`). Type positions are stage fractions, so they
carry over, but revisit sizes (serif words ≤ 170 px), move side-placed props to the lower centre, and
widen fov by about 15° so the clouds still frame the sky.
