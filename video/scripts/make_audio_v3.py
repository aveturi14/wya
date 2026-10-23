"""
Draft 3 music: dark deep house / UK garage, synthesised from scratch with numpy (no samples).
A minor, Am9 – Fmaj7 – Dm9 – Em7. Deep kick, swung hats, garage rims, a syncopated sub,
electric-piano stabs, a filtered pad, a vowel chop, and a detuned bass on the drops. Reverb on a send.

The arrangement follows the story (src/v3/data.ts): a low-passed intro under the chat bubbles,
a sub drop on "Where ya at?", a chord hit on "wya.", the groove through the plan, a breakdown on
"Then the bill came", the drop on "Snap it", a second lift on "Pay", and a chord hit on the close.

    python3 -I scripts/make_audio_v3.py      → public/audio/music_v3.wav

Tempo 128.57 BPM (14 frames per beat at 30 fps), 46 bars.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_audio as m  # noqa: E402  (filters, oscillators, wav writer)

SR, BEAT = m.SR, m.BEAT
BAR = BEAT * 4
BARS = 46
LENGTH = BAR * BARS
N = int(LENGTH * SR) + 2 * SR
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "audio", "music_v3.wav")
rng = np.random.default_rng(23)

ORDER = [("hook", 4), ("problem", 3), ("home", 2), ("create", 3), ("open", 2), ("link", 3), ("pledge", 3), ("host", 2),
         ("chat", 3), ("album", 2), ("bill", 3), ("snap", 3), ("tick", 3), ("adds", 2), ("pay", 3), ("square", 2), ("close", 3)]
S, _a = {}, 0
for _n, _b in ORDER:
    S[_n] = _a
    _a += _b
assert _a == BARS

BIG = 2 - 6 / 56            # "Where ya at?" (6 frames before bar 2)
LOGO = 3                    # "wya." in the hook
BILL, SNAP, PAY, CLOSE = S["bill"], S["snap"], S["pay"], S["close"]
FINAL = CLOSE + 2           # "Coming soon"

# A minor: Am9 – Fmaj7 – Dm9 – Em7
SUBS = [33, 29, 38, 40]                                   # A1 F1 D2 E2
CHORDS = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64]]
CHOP = [76, 74, 72, 69, 72, 74, 71, 67]                   # E5 D5 C5 A4 C5 D5 B4 G4


def put(buf, beats, sig, g=1.0):
    """Place a signal at a position given in beats."""
    m.at(buf, beats * BEAT, sig, g)


def env(n, a, d, s=0.0, r=0.0):
    return m.env(n, a, d, s, r or None)


def sw(beat16):
    """Swung 16th: every second 16th is pushed late (58% swing)."""
    return beat16 * 0.25 + (0.04 if beat16 % 2 else 0.0)


# ---------------------------------------------------------------- instruments
def kick():
    d = 0.55
    t = np.arange(int(d * SR)) / SR
    f = 41 + 95 * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.32)
    click = m.highpass(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.002) * 0.12
    return np.tanh((body + click) * 1.9) * 0.95


def clap():
    d = 0.35
    n = int(d * SR)
    x = rng.standard_normal(n)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.009, 0.019, 0.028]):
        i = int(off * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / (0.008 if k < 3 else 0.13)) * (0.6 if k < 3 else 1)
    x = m.highpass(m.lowpass(x * e, 3400), 1000)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.035) * 0.3
    return (x / (np.abs(x).max() + 1e-9) * 0.6 + body) * 0.75


def rim():
    d = 0.06
    t = np.arange(int(d * SR)) / SR
    x = np.sin(2 * np.pi * 1650 * t) * np.exp(-t / 0.008) + m.highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004) * 0.5
    return x * 0.3


def hat(open_=False):
    d = 0.22 if open_ else 0.045
    n = int(d * SR)
    x = m.highpass(rng.standard_normal(n), 8500) * env(n, 0.001, 0.07 if open_ else 0.011)
    return x / (np.abs(x).max() + 1e-9) * (0.24 if open_ else 0.2)


def sub(midi, beats):
    dur = beats * BEAT
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = m.note(midi)
    x = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)
    return np.tanh(x * 1.3 * env(n, 0.004, 0.5, 0.75, 0.03)) * 0.55


def reese(midi, beats, cutoff=420):
    dur = beats * BEAT
    n = int(dur * SR)
    f = m.note(midi)
    x = m.saw(f, dur, -0.007) + m.saw(f, dur, 0.007) + 0.5 * m.saw(f / 2, dur)
    x = m.lowpass(x, cutoff) * env(n, 0.01, 1.0, 0.85, 0.05)
    return np.tanh(x * 1.2) * 0.32


def ep(midi, beats, bright=1.0):
    """FM electric piano (Rhodes-ish): carrier + modulator at 1:1, plus a quick tine."""
    dur = beats * BEAT + 0.25
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = m.note(midi)
    idx = (1.6 * np.exp(-t / 0.22) + 0.25) * bright
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    x += 0.12 * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t / 0.02) * bright
    e = env(n, 0.003, 1.1, 0.0)
    e[int(beats * BEAT * SR):] *= np.linspace(1, 0, n - int(beats * BEAT * SR))
    return x * e * 0.16


def ep_chord(chord, beats, bright=1.0, cutoff=4000):
    x = sum(ep(n, beats, bright) for n in chord)
    return m.lowpass(x, cutoff)


def pad(chord, beats, cutoff):
    dur = beats * BEAT
    n = int(dur * SR)
    x = sum(m.saw(m.note(k - 12), dur, d) for k in chord for d in (-0.005, 0.0, 0.006))
    x = m.lowpass(x / (len(chord) * 3), cutoff) * env(n, 0.25, 2.0, 0.8, 0.3)
    return x * 0.5


def chop(midi, beats=0.4):
    """A vowel-ish synth chop: a pulse through two formant bands ("ah")."""
    dur = beats * BEAT
    n = int(dur * SR)
    f = m.note(midi)
    t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + m.saw(f, dur, 0.004) * 0.5
    a = m.highpass(m.lowpass(x, 1000), 560)
    b = m.highpass(m.lowpass(x, 1500), 950) * 0.6
    c = m.highpass(m.lowpass(x, 3000), 2300) * 0.25
    return (a + b + c) * env(n, 0.006, 0.12, 0.4, 0.04) * 0.55


def noise_riser(beats):
    return m.noise_riser(beats * BEAT)


def sub_drop(dur=1.6):
    t = np.arange(int(dur * SR)) / SR
    f = 30 + 55 * np.exp(-t / 0.25)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7) * 1.6) * 0.8


def reverse_swell(beats):
    n = int(beats * BEAT * SR)
    x = m.lowpass(rng.standard_normal(n), 5000) * np.linspace(0, 1, n) ** 3
    return x * 0.2


def reverb(x, seconds=2.2, seed=1):
    """Convolution with decaying noise (a cheap, smooth hall)."""
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = m.lowpass(r.standard_normal(n), 6000) * np.exp(-t / (seconds / 6.5))
    ir[: int(0.012 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    L = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
    return y


# ---------------------------------------------------------------- arrangement
def build():
    drums, subb, bassr, keys, pads, chops, fx, send = (np.zeros(N) for _ in range(8))
    K, CL, RM, HC, HO = kick(), clap(), rim(), hat(), hat(True)

    for bar in range(FINAL):
        b0 = bar * 4
        ci = bar % 4
        chord, root = CHORDS[ci], SUBS[ci]
        intro = bar < 2
        half = 2 <= bar < 4                       # the title and logo: half-time
        brk = BILL <= bar < BILL + 2              # "Then the bill came"
        build_up = bar == SNAP - 1
        drop = SNAP <= bar < SNAP + 3 or PAY <= bar < CLOSE
        outro = bar >= CLOSE
        full = not (intro or half or brk or build_up)

        # ---- drums
        for beat in range(4):
            if full or (half and beat in (0, 2)) or (build_up and beat in (0, 1, 2, 3)):
                put(drums, b0 + beat, K, 1.0)
            if intro and bar == 1 and beat == 3:
                put(drums, b0 + beat, K, 0.6)
        if build_up:  # kicks double up into the drop
            for e in range(4):
                put(drums, b0 + 3 + e * 0.25, K, 0.5 + 0.1 * e)
        if full or half or brk:
            for beat in ((1, 3) if full else (2,)):
                put(drums, b0 + beat, CL, 0.85 if not brk else 0.55)
        # hats: swung 16ths, open hat on the offbeat
        for s in range(16):
            if brk and s % 4:
                continue
            vel = (0.55 if s % 2 else 0.3) * (0.55 if intro else 1.0)
            if full or intro or half or brk or build_up:
                put(drums, b0 + sw(s), HC, vel)
        if full:
            for beat in range(4):
                put(drums, b0 + beat + 0.5, HO, 0.75)
            # garage rims: ghost notes that change every other bar
            for p in ((0.75, 1.75, 2.5, 3.75) if bar % 2 else (0.75, 2.25, 3.25)):
                put(drums, b0 + p, RM, 0.7)
        if full and bar % 4 == 3:  # a small fill
            for e in range(3):
                put(drums, b0 + 3.25 + e * 0.25, RM, 0.6 + 0.15 * e)

        # ---- sub bass: syncopated garage line; long notes in the intro and break
        if intro or brk:
            put(subb, b0, sub(root, 3.8), 0.75 if intro else 0.9)
        elif half:
            put(subb, b0, sub(root, 1.8), 1.0)
            put(subb, b0 + 2, sub(root, 1.8), 1.0)
        else:
            for p, k, ln in ((0, 0, 0.7), (0.75, 0, 0.5), (1.5, 12, 0.4), (2.5, 0, 0.6), (3.25, 10, 0.5)):
                put(subb, b0 + p, sub(root + k, ln), 0.95)
        if drop:
            put(bassr, b0, reese(root + 12, 4, 380 + 160 * (bar % 2)), 1.0)

        # ---- keys
        if intro:
            put(keys, b0, ep_chord(chord, 3.8, 0.7, 1300 + 900 * bar), 1.0)
        elif half:
            put(keys, b0, ep_chord(chord, 1.6, 1.0, 3000), 1.0)
        elif brk:
            put(keys, b0, ep_chord(chord, 3.8, 0.8, 1600), 1.0)
            put(keys, b0 + 2.75, ep_chord([n + 12 for n in chord[2:]], 0.6, 0.6, 2200), 0.6)
        elif not outro or bar < FINAL:
            for p, ln in ((0.0, 0.35), (0.75, 0.3), (1.5, 0.45), (2.75, 0.3), (3.5, 0.4)):
                if p == 0.0 and not drop:
                    continue
                put(keys, b0 + p, ep_chord(chord, ln, 1.0, 3800 if drop else 3000), 0.9)

        # ---- pad: always under it, opening up through the film, darker in the break
        cutoff = 700 if intro else 900 if brk else 1100 + 25 * bar
        if not half:
            put(pads, b0, pad(chord, 4, cutoff), 1.0)

        # ---- vowel chop on the link → host stretch, the chat, and both drops
        if (S["link"] <= bar < S["chat"] and bar % 2 == 0) or S["chat"] <= bar < BILL or drop:
            for e, p in enumerate((0.5, 1.25, 2.0, 3.0)):
                put(chops, b0 + p, chop(CHOP[(e + 4 * (bar % 2)) % 8]), 0.8)

    # ---- moments
    put(fx, 4, noise_riser(4 * (BIG - 1)), 0.9)                   # into "Where ya at?"
    put(fx, BIG * 4, sub_drop(), 1.0)
    put(fx, BIG * 4, ep_chord([n + 12 for n in CHORDS[0]], 3, 1.2, 5000), 1.2)
    put(send, BIG * 4, ep_chord([n + 12 for n in CHORDS[0]], 3, 1.2, 5000), 1.6)
    put(fx, LOGO * 4 - 2, reverse_swell(2), 1.0)                   # "wya."
    put(fx, LOGO * 4, ep_chord([n + 12 for n in CHORDS[3]], 3.6, 1.0, 5200), 1.1)
    put(send, LOGO * 4, ep_chord([n + 12 for n in CHORDS[3]], 3.6, 1.0, 5200), 1.8)
    put(fx, BILL * 4, sub_drop(2.0), 0.9)                           # "Then the bill came"
    put(fx, (SNAP - 1) * 4, noise_riser(4), 1.1)                    # into the drop
    put(fx, SNAP * 4, sub_drop(), 0.9)
    put(fx, (PAY - 1) * 4 + 2, reverse_swell(2), 1.0)
    put(fx, CLOSE * 4 - 2, reverse_swell(2), 1.0)                   # the close
    put(fx, CLOSE * 4, sub_drop(), 0.8)
    put(fx, FINAL * 4 - 2, reverse_swell(2), 1.2)                   # "Coming soon"
    put(fx, FINAL * 4, sub_drop(2.4), 1.0)
    put(fx, FINAL * 4, kick(), 1.0)
    final = ep_chord([45, 57, 60, 64, 67, 71], 7, 1.1, 4200)
    put(fx, FINAL * 4, final, 1.3)
    put(send, FINAL * 4, final, 2.0)
    put(pads, FINAL * 4, pad(CHORDS[0], 8, 1400), 1.0)

    # ---- sidechain from every kick in the groove
    pump = np.ones(N)
    shape = 1 - 0.7 * np.exp(-np.arange(int(BEAT * SR)) / SR / 0.09)
    for bar in range(FINAL):
        if bar < 2 or BILL <= bar < SNAP - 1:
            continue
        for beat in ((0, 2) if bar in (2, 3) else (0, 1, 2, 3)):
            i = int((bar * 4 + beat) * BEAT * SR)
            j = min(N, i + len(shape))
            pump[i:j] = np.minimum(pump[i:j], shape[: j - i])
    keys *= 0.45 + 0.55 * pump
    pads *= 0.25 + 0.75 * pump
    chops *= 0.5 + 0.5 * pump
    bassr *= 0.35 + 0.65 * pump

    # ---- reverb send: keys, chops, pad, moments
    wet_in = keys * 0.35 + chops * 0.6 + pads * 0.15 + send * 0.5
    wl, wr = reverb(wet_in, 2.4, 1), reverb(wet_in, 2.4, 2)

    dry = drums * 0.5 + subb * 0.62 + bassr * 0.9 + keys * 1.5 + pads * 1.1 + chops * 1.3 + fx * 0.55
    d = int(0.011 * SR)
    haas = np.zeros(N)
    haas[d:] = (keys * 1.5 + chops * 1.3 + pads * 1.1)[:-d]
    left = dry + wl * 0.7
    right = dry - (keys * 1.5 + chops * 1.3 + pads * 1.1) * 0.25 + haas * 0.25 + wr * 0.7

    # ---- master: gentle glue, soft clip, -1 dBFS
    out = np.stack([left, right], axis=1)
    out /= np.percentile(np.abs(out), 99.95) + 1e-9
    out = np.tanh(out * 0.95)
    out /= np.abs(out).max() + 1e-9
    out *= 10 ** (-1 / 20)
    n = int(LENGTH * SR)
    out = out[:n].copy()
    fade = int(0.6 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return out


if __name__ == "__main__":
    music = build()
    m.write_wav(OUT, music)
    print(f"music_v3.wav  {len(music) / SR:.2f}s  peak {np.abs(music).max():.2f}")
