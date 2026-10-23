"""
Draft 4 music: bass house / tech house, synthesised from scratch with numpy (no samples).
A minor. Punchy kick, big clap, straight 16th hats and shaker, open hats on the offbeat, a rolling
offbeat bassline, a gritty "talking" growl bass on the drops, dark minor stabs, snare-roll builds,
risers and impacts. No soft keys, no bells, no melody line.

The arrangement follows the story (src/v3/data.ts): a filtered groove under the chat bubbles,
a build into the first growl drop on "Where ya at?", a hard stop on "wya.", the groove through
the plan, a breakdown on "Then the bill came", the main drop on "Snap it", a second drop on "Pay",
and a final hit on "Coming soon".

    python3 -I scripts/make_audio_v4.py      → public/audio/music_v4.wav

Tempo 128.57 BPM (14 frames per beat at 30 fps), 48 bars.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_audio as m  # noqa: E402  (filters, oscillators, wav writer)

SR, BEAT = m.SR, m.BEAT
BARS = 48
LENGTH = BEAT * 4 * BARS
N = int(LENGTH * SR) + 2 * SR
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "audio", "music_v4.wav")
rng = np.random.default_rng(41)

ORDER = [("hook", 4), ("problem", 3), ("home", 2), ("create", 3), ("open", 2), ("link", 3), ("pledge", 3), ("host", 2),
         ("chat", 3), ("album", 2), ("bill", 3), ("snap", 3), ("tick", 3), ("adds", 2), ("pay", 5), ("square", 2), ("close", 3)]
S, _a = {}, 0
for _n, _b in ORDER:
    S[_n] = _a
    _a += _b
assert _a == BARS

BIG = 2 - 6 / 56            # "Where ya at?" lands 6 frames before bar 2
LOGO = 3                    # "wya." — a hard stop
BILL, SNAP, PAY, CLOSE = S["bill"], S["snap"], S["pay"], S["close"]
FINAL = CLOSE + 2           # "Coming soon"

# A minor, two-bar bass phrases: A A A C | A A G E (as offsets from A1 = 33)
ROOT = 33
PHRASE = [[0, 0, 0, 3], [0, 0, -2, -5]]         # per beat, semitones from A
STAB = [[57, 60, 64], [55, 60, 63], [53, 57, 60], [52, 55, 59]]  # Am, Cm/G, F, Em (dark)
GROWL = [0, 0, 12, 0, 0, 7, 0, 10]              # 8ths, semitones from A1 (talking pattern)
WAH = [500, 1900, 800, 2600, 600, 1500, 3200, 900]


def put(buf, beats, sig, g=1.0):
    m.at(buf, beats * BEAT, sig, g)


def env(n, a, d, s=0.0, r=0.0):
    return m.env(n, a, d, s, r or None)


# ---------------------------------------------------------------- instruments
def kick():
    d = 0.38
    t = np.arange(int(d * SR)) / SR
    f = 50 + 160 * np.exp(-t / 0.022)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    click = m.highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.0025) * 0.35
    return np.tanh((body + click) * 2.6) * 0.95


def clap():
    d = 0.42
    n = int(d * SR)
    x = rng.standard_normal(n)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.008, 0.017, 0.026]):
        i = int(off * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / (0.007 if k < 3 else 0.16)) * (0.7 if k < 3 else 1)
    x = m.highpass(m.lowpass(x * e, 5000), 900)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.03) * 0.35
    return np.tanh((x / (np.abs(x).max() + 1e-9) + body) * 1.6) * 0.62


def snare():
    d = 0.2
    n = int(d * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 200 * t) * np.exp(-t / 0.04) * 0.6
    noise = m.highpass(rng.standard_normal(n), 1800) * np.exp(-t / 0.06)
    return np.tanh((tone + noise) * 1.5) * 0.5


def hat(open_=False):
    d = 0.24 if open_ else 0.04
    n = int(d * SR)
    x = m.highpass(rng.standard_normal(n), 8000) * env(n, 0.001, 0.09 if open_ else 0.01)
    return x / (np.abs(x).max() + 1e-9) * (0.3 if open_ else 0.2)


def shaker():
    d = 0.06
    n = int(d * SR)
    x = m.highpass(rng.standard_normal(n), 6000) * env(n, 0.008, 0.018)
    return x / (np.abs(x).max() + 1e-9) * 0.12


def crash():
    d = 2.0
    n = int(d * SR)
    x = m.highpass(rng.standard_normal(n), 3500) * np.exp(-np.arange(n) / SR / 0.6)
    return x / (np.abs(x).max() + 1e-9) * 0.3


def roll_bass(semi, beats, cutoff):
    """The rolling offbeat bass: a plucky, saturated saw + sub."""
    dur = beats * BEAT
    n = int(dur * SR)
    f = m.note(ROOT + 12 + semi)
    x = m.saw(f, dur) * 0.7 + np.sin(2 * np.pi * (f / 2) * np.arange(n) / SR) * 0.8
    x = m.lowpass(x, cutoff) * env(n, 0.002, 0.09, 0.35, 0.015)
    return np.tanh(x * 2.2) * 0.5


def growl(semi, beats, wah):
    """Bass-house 'talking' growl: detuned saw + square, formant-ish band, hard saturation."""
    dur = beats * BEAT
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = m.note(ROOT + 12 + semi)
    x = m.saw(f, dur, -0.006) + m.saw(f, dur, 0.006) + np.sign(np.sin(2 * np.pi * f * t)) * 0.8
    band = m.highpass(m.lowpass(x, wah), wah * 0.35)
    body = m.lowpass(x, 180) * 0.8
    y = np.tanh((band * 1.6 + body) * 2.4) * env(n, 0.003, 0.2, 0.7, 0.02)
    return y * 0.42


def stab(chord, beats, cutoff=2400):
    dur = beats * BEAT
    n = int(dur * SR)
    x = sum(m.saw(m.note(k), dur, d) for k in chord for d in (-0.007, 0.0, 0.008))
    x = m.lowpass(x / (len(chord) * 3), cutoff) * env(n, 0.003, 0.12, 0.2, 0.03)
    return np.tanh(x * 2) * 0.5


def dark_pad(chord, beats, cutoff=900):
    dur = beats * BEAT
    n = int(dur * SR)
    x = sum(m.saw(m.note(k - 12), dur, d) for k in chord for d in (-0.006, 0.0, 0.007))
    return m.lowpass(x / (len(chord) * 3), cutoff) * env(n, 0.4, 3.0, 0.85, 0.4) * 0.5


def riser(beats):
    return m.noise_riser(beats * BEAT) * 1.2


def pitch_riser(beats):
    """A saw sweeping up an octave and a half, for builds."""
    dur = beats * BEAT
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 110 * 2 ** (1.5 * t / dur)
    x = 2 * ((np.cumsum(f) / SR) % 1) - 1
    return m.lowpass(x, 3000) * (t / dur) ** 2 * 0.25


def impact():
    d = 2.4
    t = np.arange(int(d * SR)) / SR
    f = 32 + 70 * np.exp(-t / 0.12)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.8)
    air = m.lowpass(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.3) * 0.5
    return np.tanh((boom + air) * 1.6) * 0.85


def reverb(x, seconds=1.6, seed=1):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = m.lowpass(r.standard_normal(n), 7000) * np.exp(-t / (seconds / 6.5))
    ir[: int(0.01 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    L = 1 << int(np.ceil(np.log2(len(x) + n)))
    return np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]


# ---------------------------------------------------------------- arrangement
def build():
    drums, bass, lead, stabs, pads, fx, send = (np.zeros(N) for _ in range(7))
    K, CL, SN, HC, HO, SH, CR = kick(), clap(), snare(), hat(), hat(True), shaker(), crash()

    for bar in range(FINAL):
        b0 = bar * 4
        phrase = PHRASE[bar % 2]
        chord = STAB[bar % 4]
        intro = bar < 2
        stop = bar == LOGO                      # "wya.": the hard stop
        brk = BILL <= bar < SNAP - 1
        build_up = bar == SNAP - 1
        drop = 2 <= bar < LOGO or SNAP <= bar < SNAP + 3 or PAY <= bar < CLOSE
        groove = not (intro or stop or brk or build_up)

        if bar in S.values() and bar not in (0, BILL, LOGO):
            put(fx, b0, CR, 1.0)

        # ---- drums
        for beat in range(4):
            if groove or intro or (stop and beat == 0):
                put(drums, b0 + beat, K, 0.8 if intro else 1.0)
            if groove and beat in (1, 3):
                put(drums, b0 + beat, CL, 1.0)
            if brk and beat == 2:
                put(drums, b0 + beat, CL, 0.6)
            if groove or intro:
                for s in range(4):
                    put(drums, b0 + beat + s / 4, HC, (0.7 if s % 2 else 0.4) * (0.6 if intro else 1))
            if groove:
                put(drums, b0 + beat + 0.5, HO, 0.9)
                for s in range(4):
                    put(drums, b0 + beat + s / 4, SH, 0.9)
            if brk:
                put(drums, b0 + beat + 0.5, HC, 0.4)
        if groove and bar % 4 == 3 and not drop:  # snare fill into each phrase
            for s in range(4):
                put(drums, b0 + 3 + s / 4, SN, 0.35 + 0.15 * s)
        if bar == 1 or build_up:  # snare roll builds
            div = 8 if bar == 1 else 16
            start = 2 if bar == 1 else 0
            span = 4 - start
            steps = int(span * (div / 4))
            for s in range(steps):
                put(drums, b0 + start + s * span / steps, SN, 0.2 + 0.6 * s / steps)

        # ---- rolling bass: the off-16ths of every beat ("and", "a"), filter opening through the film
        if groove or intro:
            cutoff = (500 + 500 * bar) if intro else (1400 if not drop else 900) + 15 * bar
            for beat in range(4):
                semi = phrase[beat]
                for s, g in ((0.5, 1.0), (0.75, 0.8)):
                    put(bass, b0 + beat + s, roll_bass(semi, 0.22, cutoff), g)
        if brk:
            put(bass, b0, roll_bass(phrase[0], 3.6, 300), 0.9)

        # ---- growl lead on the drops (talking 8ths, wah changes per note)
        if drop:
            for e in range(8):
                if e in (3,) and bar % 2:  # a breath in the phrase
                    continue
                semi = GROWL[e] + (phrase[e // 2] if e % 2 == 0 else 0)
                put(lead, b0 + e / 2, growl(semi, 0.48, WAH[(e + bar) % 8]), 1.0)

        # ---- dark stabs: offbeats in the groove (not under the growl), long pads in the break
        if groove and not drop:
            for p in (0.5, 1.75, 2.5, 3.5):
                put(stabs, b0 + p, stab(chord, 0.3, 2000 + 20 * bar), 0.75)
        if brk or build_up:
            put(pads, b0, dark_pad(chord, 4, 700 if brk else 1500), 1.0)
            put(stabs, b0, stab([n + 12 for n in chord], 1.0, 1200), 0.5)

    # ---- moments
    put(fx, 4, riser(4 * (BIG - 1)), 1.0)                      # into "Where ya at?"
    put(fx, 4, pitch_riser(4 * (BIG - 1)), 1.0)
    put(fx, BIG * 4, impact(), 1.0)
    put(fx, BIG * 4, CR, 1.0)
    put(fx, LOGO * 4, impact(), 0.9)                            # "wya." hard stop
    put(fx, LOGO * 4, stab([45, 57, 60, 64], 3.5, 3000), 0.9)
    put(send, LOGO * 4, stab([45, 57, 60, 64], 3.5, 3000), 1.4)
    put(fx, LOGO * 4 + 2, riser(2), 0.8)                        # back in on the problem
    put(fx, BILL * 4, impact(), 0.85)                           # "Then the bill came"
    put(fx, (SNAP - 1) * 4, riser(4), 1.1)                      # build into the drop
    put(fx, (SNAP - 1) * 4, pitch_riser(4), 1.1)
    put(fx, SNAP * 4, impact(), 1.0)
    put(fx, (PAY - 1) * 4 + 2, riser(2), 0.9)
    put(fx, PAY * 4, impact(), 0.7)
    put(fx, (FINAL - 1) * 4, riser(4), 1.0)
    put(fx, FINAL * 4, impact(), 1.1)
    put(fx, FINAL * 4, kick(), 1.0)
    put(fx, FINAL * 4, CR, 1.0)
    end = stab([45, 57, 60, 64, 69], 6, 2600)
    put(fx, FINAL * 4, end, 1.0)
    put(send, FINAL * 4, end, 1.6)
    put(pads, FINAL * 4, dark_pad(STAB[0], 8, 1100), 1.0)

    # ---- sidechain every kick of the groove
    pump = np.ones(N)
    shape = 1 - 0.75 * np.exp(-np.arange(int(BEAT * SR)) / SR / 0.075)
    for bar in range(FINAL):
        if bar == LOGO or BILL <= bar < SNAP - 1:
            continue
        for beat in range(4):
            i = int((bar * 4 + beat) * BEAT * SR)
            j = min(N, i + len(shape))
            pump[i:j] = np.minimum(pump[i:j], shape[: j - i])
    bass *= 0.3 + 0.7 * pump
    lead *= 0.4 + 0.6 * pump
    stabs *= 0.35 + 0.65 * pump
    pads *= 0.3 + 0.7 * pump

    wet_in = stabs * 0.5 + pads * 0.3 + send * 0.6 + drums * 0.04
    wl, wr = reverb(wet_in, 1.6, 1), reverb(wet_in, 1.6, 2)

    dry = drums * 0.62 + bass * 0.8 + lead * 0.75 + stabs * 0.7 + pads * 0.7 + fx * 0.6
    d = int(0.012 * SR)
    haas = np.zeros(N)
    haas[d:] = (stabs * 0.7 + pads * 0.7)[:-d]
    left = dry + wl * 0.55
    right = dry - (stabs * 0.7 + pads * 0.7) * 0.3 + haas * 0.3 + wr * 0.55

    out = np.stack([left, right], axis=1)
    out /= np.percentile(np.abs(out), 99.9) + 1e-9
    out = np.tanh(out * 1.1)
    out /= np.abs(out).max() + 1e-9
    out *= 10 ** (-1 / 20)
    n = int(LENGTH * SR)
    out = out[:n].copy()
    fade = int(0.5 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return out


if __name__ == "__main__":
    music = build()
    m.write_wav(OUT, music)
    print(f"music_v4.wav  {len(music) / SR:.2f}s  peak {np.abs(music).max():.2f}")
