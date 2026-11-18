# Imaginary-world-
The channel which will explain about imaginary things that is impossible in real life

## Making videos

Videos are made in code with the **motion-reel** skill (`.claude/skills/motion-reel/`): a Three.js
cloud world, floating 3D props, frosted-glass UI and kinetic type, cut to a voice-over, with a
synthesized score and sound design, rendered frame by frame to a 60 fps MP4.

```bash
bash .claude/skills/motion-reel/scripts/new_project.sh reels/my-film   # new film from the template
cd reels/my-film && node server.mjs 8123 &                             # preview at http://localhost:8123/
```

Workflow, style rules and quality bar: `.claude/skills/motion-reel/SKILL.md`.
Engine internals and gotchas: `.claude/skills/motion-reel/references/engine.md`.
Sound: `.claude/skills/motion-reel/references/sound.md`.

Needs Node 18+, Playwright with Chromium, ffmpeg, and Python 3 with numpy, Pillow and scipy
(plus pocketsphinx for voice-over alignment).
