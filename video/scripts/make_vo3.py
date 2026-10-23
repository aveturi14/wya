"""
Generate the draft 3+ voiceover with Kokoro (open-source text-to-speech that runs on this Mac).

Setup, once (in your own terminal; see video/README.md):
    python3 -m venv scripts/.venv
    scripts/.venv/bin/pip install kokoro-onnx soundfile
    mkdir -p scripts/models
    curl -L -o scripts/models/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -L -o scripts/models/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

Then:
    scripts/.venv/bin/python scripts/make_vo3.py                  # am_michael, speed 1.08
    scripts/.venv/bin/python scripts/make_vo3.py --voice am_fenrir --speed 1.12

Reads the lines from src/v3/vo.ts, writes public/audio/vo3/<id>.wav (trimmed, levelled) and
src/v3/voTimings.ts (each clip's length in frames), and warns when a clip runs into the next line
or past the end of its beat.
"""
import argparse
import os
import re
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
MODELS = os.path.join(HERE, "models")
OUT = os.path.join(ROOT, "public", "audio", "vo3")
FPS, BAR = 30, 56
ORDER = [("hook", 4), ("problem", 3), ("home", 2), ("create", 3), ("open", 2), ("link", 3), ("pledge", 3), ("host", 2),
         ("chat", 3), ("album", 2), ("bill", 3), ("snap", 3), ("tick", 3), ("adds", 2), ("pay", 5), ("square", 2), ("close", 3)]


def beats():
    out, at = {}, 0
    for name, bars in ORDER:
        out[name] = (at * BAR, bars * BAR)
        at += bars
    return out


def read_lines():
    src = open(os.path.join(ROOT, "src", "v3", "vo.ts"), encoding="utf8").read()
    pat = r"\{ id: '(\w+)', beat: '(\w+)', at: (\d+), text: (?:\"(.+?)\"|'(.+?)') \}"
    return [(i, b, int(a), t1 or t2) for i, b, a, t1, t2 in re.findall(pat, src)]


BRAND = re.compile(r"where you at", re.I)
# "where you at": three words in one quick run, light stress on "where", the weight on "at"
BRAND_IPA = "wˌɛɹ ju ˈæt"
# Words espeak gets wrong (checked by printing every line's phonemes before rendering)
FIXES = {"jˈuːbɚ": "ˈuːbɚ"}  # Uber, not "you-ber"


def phonemes(k, text):
    """Phonemize a line, swapping every "where you at" for the fast, run-together form."""
    parts = BRAND.split(text)
    out = []
    for i, part in enumerate(parts):
        if part.strip():
            out.append(k.tokenizer.phonemize(part, "en-us").strip())
        if i < len(parts) - 1:
            out.append(BRAND_IPA)
    line = " ".join(out)
    for wrong, right in FIXES.items():
        line = line.replace(wrong, right)
    return re.sub(r" ([?.!,])", r"\1", line)


def trim(x, sr, thresh=0.01):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(0.02 * sr))
    b = min(len(x), idx[-1] + int(0.08 * sr))
    return x[a:b]


def write(path, x, sr):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="am_fenrir")
    ap.add_argument("--speed", type=float, default=1.05)
    ap.add_argument("--out", default="vo3", help="folder under public/audio/")
    args = ap.parse_args()
    from kokoro_onnx import Kokoro

    k = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
    out_dir = os.path.join(ROOT, "public", "audio", args.out)
    os.makedirs(out_dir, exist_ok=True)
    lines = read_lines()
    B = beats()
    frames = {}
    for n, (vid, beat, at, text) in enumerate(lines):
        # One sentence at a time, with a short breath between: a single long read flattens the delivery
        parts = [p for p in re.split(r"(?<=[.?!])\s+", text) if p.strip()]
        chunks = []
        for j, part in enumerate(parts):
            y, sr = k.create(phonemes(k, part), voice=args.voice, speed=args.speed, lang="en-us", is_phonemes=True)
            chunks.append(trim(np.asarray(y, dtype=np.float64), sr))
            if j < len(parts) - 1:
                gap = 0.22 if part.endswith("...") else 0.12
                chunks.append(np.zeros(int(gap * sr)))
        x = np.concatenate(chunks)
        x = x / (np.abs(x).max() + 1e-9) * 0.89
        write(os.path.join(out_dir, f"{vid}.wav"), x, sr)
        frames[vid] = int(np.ceil(len(x) / sr * FPS))
        start = B[beat][0] + at
        end = start + frames[vid]
        nxt = B[lines[n + 1][1]][0] + lines[n + 1][2] if n + 1 < len(lines) else B["close"][0] + B["close"][1]
        flag = "  ⚠ runs into the next line" if end > nxt - 4 else ""
        print(f"{vid:8s} {frames[vid] / FPS:4.1f}s  frames {start}-{end} (next {nxt}){flag}")
    with open(os.path.join(ROOT, "src", "v3", "voTimings.ts" if args.out == "vo3" else f"voTimings_{args.out}.ts"), "w", encoding="utf8") as f:
        f.write("// Written by scripts/make_vo3.py: each clip's length in frames. Empty until the voice is generated.\n")
        f.write("export const VO_FRAMES: Record<string, number> = {\n")
        for vid, fr in frames.items():
            f.write(f"  {vid}: {fr},\n")
        f.write("};\n")
    print(f"voice {args.voice} · speed {args.speed} · wrote {len(frames)} clips to public/audio/{args.out}/")


if __name__ == "__main__":
    main()
