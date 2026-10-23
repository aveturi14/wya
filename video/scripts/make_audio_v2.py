"""
Draft 2 music: the same original synth kit as make_audio.py, arranged hotter.
Driving four-on-the-floor from the first frame, 16th hats, rolling 16th bass,
clap + snare on 2 and 4, crashes and risers into every section, fills every two bars,
a big drop on the group card, and a sonic logo before "Coming soon".

    python3 -I scripts/make_audio_v2.py      → public/audio/music_v2.wav

Tempo 128.57 BPM (14 frames per beat at 30 fps), 31 bars, matching src/v2/data.ts.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_audio as m  # noqa: E402  (the synth kit)

SR, BEAT = m.SR, m.BEAT
BAR = BEAT * 4
BARS = 31
LENGTH = BAR * BARS
N = int(LENGTH * SR) + SR
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "audio", "music_v2.wav")
rng = np.random.default_rng(11)

# Sections (bars), matching src/v2/data.ts
HOOK, PROMISE, PLAN, SPLIT, SETTLE, NEXT, CLOSE = 0, 3, 5, 11, 18, 23, 28
EVERYONE = 1.5   # "Everyone's in" (bar position)
NOBODY = 2       # "Nobody's paid": the break
CARD = NEXT + 2  # the group card drop (bar 25)
FINAL = CLOSE + 2


def at(buf, s, sig, g=1.0):
    m.at(buf, s, sig, g)


def snare():
    d = 0.22
    n = int(d * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.6
    noise = m.highpass(rng.standard_normal(n), 1500) * np.exp(-t / 0.07) * 0.7
    return np.tanh((tone + noise) * 1.4) * 0.6


def crash():
    d = 1.6
    n = int(d * SR)
    x = m.highpass(rng.standard_normal(n), 4000) * np.exp(-np.arange(n) / SR / 0.55)
    return x / (np.abs(x).max() + 1e-9) * 0.35


def supersaw(midis, dur, cutoff):
    s = sum(m.saw(m.note(n), dur, d) for n in midis for d in (-0.008, -0.003, 0.0, 0.004, 0.009))
    s = m.lowpass(s / (len(midis) * 5), cutoff) * m.env(int(dur * SR), 0.004, dur * 0.6, 0.0, 0.02)
    return s * 0.9


def build():
    drums, bass, keys, lead, fx = (np.zeros(N) for _ in range(5))
    K, CL, SN, HC, HO, SH, CR = m.kick(), m.clap(), snare(), m.hat(), m.hat(True), m.shaker(), crash()
    ROOTS, CHORDS, HOOK_NOTES = m.ROOTS, m.CHORDS, m.HOOK

    for bar in range(BARS):
        t0 = bar * BAR
        breakdown = bar == NOBODY  # one bar of air after "Nobody's paid"
        build_up = bar in (CARD - 2, CARD - 1)
        last = bar >= FINAL
        root, chord = ROOTS[bar % 4], CHORDS[bar % 4]
        if last:
            break
        # Crash on every section start, and on the drop
        if bar in (PROMISE, PLAN, SPLIT, SETTLE, CARD, CLOSE):
            at(fx, t0, CR, 1.0)
        for beat in range(4):
            tb = t0 + beat * BEAT
            if not breakdown:
                # Kick: four on the floor (half-time in the build's first bar)
                if not (build_up and bar == CARD - 2 and beat % 2):
                    at(drums, tb, K, 1.0)
                # Clap + snare on 2 and 4
                if beat in (1, 3) and not build_up:
                    at(drums, tb, CL, 0.8)
                    at(drums, tb, SN, 0.55)
                # 16th hats, accented offbeat open hats
                for s in range(4):
                    at(drums, tb + s * BEAT / 4, HC, 0.75 if s % 2 else 0.45)
                at(drums, tb + BEAT / 2, HO, 0.8)
                if bar >= PLAN:
                    for s in range(4):
                        at(drums, tb + s * BEAT / 4, SH, 0.7)
            # Rolling 16th bass (root, octave on the offbeat 16ths), silent in the breakdown
            if not breakdown:
                for s in range(4):
                    note = root + (12 if s in (2,) else 0)
                    at(bass, tb + s * BEAT / 4, m.bass_note(note, BEAT / 4 * 0.9), 0.85 if s != 0 else 0.6)
        # Fill on the last beat of every second bar: a clap/snare roll
        if bar % 2 == 1 and not breakdown and not build_up:
            for s in range(4):
                at(drums, t0 + 3 * BEAT + s * BEAT / 4, SN, 0.3 + 0.1 * s)
        # Build into the drop: snare roll speeding up, plus a riser
        if build_up:
            div = 4 if bar == CARD - 2 else 8
            for s in range(4 * div):
                at(drums, t0 + s * BEAT * 4 / (4 * div), SN, 0.2 + 0.5 * s / (4 * div))
        # Offbeat supersaw stabs everywhere except the breakdown; a sustained chord on the drop
        if not breakdown:
            if bar >= CARD and bar < CLOSE:
                at(keys, t0, supersaw([n + 12 for n in chord], BAR * 0.95, 5200), 0.9)
            for s in (0.5, 1.5, 2.5, 3.5):
                at(keys, t0 + s * BEAT, supersaw([n + 12 for n in chord], BEAT * 0.32, 4200 if bar >= SPLIT else 3200), 0.75)
        # The hook: always in the hook and promise, then every other phrase, and all through the drop and close
        hook_on = bar < NOBODY or PROMISE <= bar < PLAN + 2 or (SPLIT + 2 <= bar < SETTLE) or (SETTLE + 2 <= bar < NEXT) or bar >= CARD
        if hook_on and not breakdown:
            for e, n in enumerate(HOOK_NOTES):
                at(lead, t0 + e * BEAT / 2, m.pluck(n + (0 if bar % 2 == 0 else (-2 if e > 5 else 0)), 0.3, 5200), 1.0)
        # 16th arps from the split onwards
        if bar >= SPLIT and not breakdown:
            seq = [chord[0] + 24, chord[1] + 12, chord[2] + 12, chord[1] + 24]
            for s in range(16):
                at(lead, t0 + s * BEAT / 4, m.pluck(seq[s % 4], 0.1, 7000), 0.32)

    # Moments
    at(fx, EVERYONE * BAR, m.noise_riser(BAR * 0.5), 0.8)
    at(fx, NOBODY * BAR, m.impact() * 0.8, 1.0)
    at(fx, NOBODY * BAR, supersaw([53, 57, 60, 65, 69], 1.3, 6000) * 1.2, 1.0)
    at(fx, (NOBODY + 0.5) * BAR, m.noise_riser(BAR * 0.5), 1.0)
    at(fx, (CARD - 2) * BAR, m.noise_riser(BAR * 2), 1.2)
    at(fx, CARD * BAR, m.impact(), 1.0)
    for i, n in enumerate([72, 76, 79, 84]):  # sonic logo on the brand
        at(fx, (CLOSE + 1) * BAR + i * BEAT / 2, m.bell(n, 1.5), 1.1)
    at(fx, FINAL * BAR, m.impact() * 0.8, 1.0)
    at(fx, FINAL * BAR, m.kick(), 1.0)
    at(fx, FINAL * BAR, supersaw([53, 65, 69, 72, 77], BAR * 1.1, 5200) * 1.2, 1.0)
    at(fx, FINAL * BAR, crash(), 1.0)

    # Sidechain pump on keys and lead from every kick
    pump = np.ones(N)
    shape = 1 - 0.6 * np.exp(-np.arange(int(BEAT * SR)) / SR / 0.08)
    for b in range(FINAL * 4):
        if int(b // 4) == NOBODY:
            continue
        i = int(b * BEAT * SR)
        j = min(N, i + len(shape))
        pump[i:j] = np.minimum(pump[i:j], shape[: j - i])
    keys *= pump
    lead *= 0.55 + 0.45 * pump

    mix = drums * 0.95 + bass * 0.9 + keys * 0.5 + lead * 0.55 + fx * 0.85
    mix = np.tanh(mix * 1.25)
    mix /= np.abs(mix).max() + 1e-9
    mix *= 10 ** (-1 / 20)
    d = int(0.012 * SR)
    wide = np.zeros(N)
    wide[d:] = (keys * 0.5 + lead * 0.55)[:-d]
    left = mix
    right = mix * 0.9 + np.tanh(wide) * 0.1
    right /= max(1.0, np.abs(right).max() / 0.89)
    n = int(LENGTH * SR)
    fade = int(0.05 * SR)
    left, right = left[:n].copy(), right[:n].copy()
    left[-fade:] *= np.linspace(1, 0, fade)
    right[-fade:] *= np.linspace(1, 0, fade)
    return np.stack([left, right], axis=1)


if __name__ == "__main__":
    music = build()
    m.write_wav(OUT, music)
    print(f"music_v2.wav  {len(music) / SR:.2f}s  peak {np.abs(music).max():.2f}")
