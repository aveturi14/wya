"""
Generate the narration with Kokoro (open-source text-to-speech, runs on this Mac).

Optional: the film renders without a voice. You need, once:

    python3 -m pip install kokoro-onnx
    mkdir -p scripts/models
    curl -L -o scripts/models/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -L -o scripts/models/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

Then:

    python3 scripts/make_vo.py            # default voice am_michael
    python3 scripts/make_vo.py --voice am_adam --speed 1.12

Writes public/audio/vo/s1.wav … s8.wav. The lines are read from src/data/demo.ts (VO),
so the script and the film never disagree. Listen to every clip before rendering:
check "Where You At" is said as words, and that no clip runs past its window
(VOICEOVER.md).
"""
import argparse
import os
import re
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
MODELS = os.path.join(HERE, "models")
OUT = os.path.join(ROOT, "public", "audio", "vo")


def read_lines():
    src = open(os.path.join(ROOT, "src", "data", "demo.ts"), encoding="utf8").read()
    block = src[src.index("export const VO = ["):]
    return re.findall(r"\{ id: '(s\d)', scene: '\w+', at: \d+, text: [\"'](.+?)[\"'] \}", block)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="am_michael")
    ap.add_argument("--speed", type=float, default=1.1)
    args = ap.parse_args()

    from kokoro_onnx import Kokoro  # imported here so the docstring help works without it

    kokoro = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
    os.makedirs(OUT, exist_ok=True)
    for vid, text in read_lines():
        # The brand is always spoken as words, never as letters
        spoken = re.sub(r"\bwya\b", "Where You At", text, flags=re.I)
        slower = vid in ("s6", "s7", "s8")
        samples, sr = kokoro.create(spoken, voice=args.voice, speed=args.speed - (0.1 if slower else 0), lang="en-us")
        pcm = (np.clip(np.asarray(samples), -1, 1) * 32767).astype("<i2")
        with wave.open(os.path.join(OUT, f"{vid}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(pcm.tobytes())
        print(f"{vid}.wav  {len(pcm) / sr:.2f}s  {text[:60]}")


if __name__ == "__main__":
    main()
