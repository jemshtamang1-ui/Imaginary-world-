#!/usr/bin/env bash
# Full render: parallel frame workers -> intermediate segments -> loudness-normalized audio -> out.mp4 + out-small.mp4
# Run from the project directory (with `node server.mjs 8123` running).
# Usage: scripts/render.sh <duration> <audio.wav|none> [workers=3] [fps=60] [w=1920] [h=1080] [range_start_frame] [range_end_frame]
#   With a frame range, only those frames are re-rendered into work/segs/patch_<a>_<b>.mp4 (see references/engine.md).
set -euo pipefail
DUR=$1; AUDIO=$2; WORKERS=${3:-3}; FPS=${4:-60}; W=${5:-1920}; H=${6:-1080}
N=$(python3 -c "import math; print(math.ceil($DUR * $FPS))")
mkdir -p work/segs
if [ -n "${7:-}" ]; then
  node tools/render_worker.cjs "$7" "$8" "$FPS" "work/segs/patch_$7_$8.mp4" "$W" "$H"
  echo "patched frames $7..$8 -> work/segs/patch_$7_$8.mp4"; exit 0
fi
rm -f work/segs/seg_*.mp4
PER=$(( (N + WORKERS - 1) / WORKERS ))
START_TS=$(date +%s)
pids=()
for ((i = 0; i < WORKERS; i++)); do
  A=$(( i * PER )); B=$(( A + PER )); (( B > N )) && B=$N
  (( A >= B )) && continue
  node tools/render_worker.cjs "$A" "$B" "$FPS" "work/segs/seg_$(printf %02d $i).mp4" "$W" "$H" &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
echo "frames rendered in $(( $(date +%s) - START_TS ))s"
: > work/segs/list.txt
for f in work/segs/seg_*.mp4; do echo "file '$(basename "$f")'" >> work/segs/list.txt; done
ffmpeg -y -loglevel error -f concat -safe 0 -i work/segs/list.txt -c copy work/video.mp4

if [ "$AUDIO" != "none" ]; then
  # two-pass loudnorm to -14 LUFS, true peak -1 dBTP
  STATS=$(ffmpeg -hide_banner -i "$AUDIO" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  get() { echo "$STATS" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
  ffmpeg -y -loglevel error -i "$AUDIO" -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" -ar 48000 work/audio_norm.wav
  AIN=(-i work/audio_norm.wav); AMAP=(-map 0:v -map 1:a -c:a aac -b:a 256k -shortest)
else
  AIN=(); AMAP=(-map 0:v)
fi
ffmpeg -y -loglevel error -i work/video.mp4 "${AIN[@]}" "${AMAP[@]}" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart out.mp4
ffmpeg -y -loglevel error -i work/video.mp4 "${AIN[@]}" "${AMAP[@]}" -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -movflags +faststart out-small.mp4
ls -lh out.mp4 out-small.mp4
echo "total $(( $(date +%s) - START_TS ))s"
