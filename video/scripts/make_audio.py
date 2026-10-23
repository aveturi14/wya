"""
Original music and sound effects for the Where You At launch reel, synthesised from
scratch with numpy (no samples, no third-party audio), so the licence is ours.

    python3 -I scripts/make_audio.py

Writes public/audio/music.wav (the full 80 s bed) and public/audio/sfx/*.wav.

The tempo is locked to the film: 14 frames per beat at 30 fps (128.57 BPM), 43 bars.
Keep BEAT_FRAMES / BARS and the section bars below in step with src/data/demo.ts.
"""
import os
import wave

import numpy as np

SR = 44100
FPS = 30
BEAT_FRAMES = 14
BARS = 43
BEAT = BEAT_FRAMES / FPS  # 0.4667 s
BAR = BEAT * 4
LENGTH = BAR * BARS
N = int(LENGTH * SR) + SR  # a second of tail room; the film ends at LENGTH
rng = np.random.default_rng(7)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "audio")

# Sections (bar numbers), matching src/data/demo.ts SCENES
CHAT, INTRO, INVITE, SPLIT, PAYBACK, CONCEPT, CHECKOUT, CLOSE = 0, 4, 8, 14, 21, 28, 35, 39
FREEZE_BAR = 2            # "Everyone's in" (drums drop out)
NOBODY_BEAT = 2 * 4 + 3   # "Nobody's paid" stab, in beats from the start
CARD_DROP = CONCEPT + 3   # the virtual card reveal (bar 31)
CHECKOUT_RELEASE = (CHECKOUT + 1) * 4 + 2  # success on beat 3 of bar 36
SORTED_BAR = PAYBACK + 5  # "4 of 4. Sorted."
BRAND_BAR = CLOSE + 2     # the logo lands
FINAL_BAR = CLOSE + 3     # last hit; ring out to the end


def t_of_beat(b):
    return b * BEAT


def at(buf, start_s, sig, gain=1.0):
    i = int(start_s * SR)
    if i >= len(buf) or i < 0:
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def env(n, attack=0.002, decay=0.2, sustain=0.0, release=None):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    d = sustain + (1 - sustain) * np.exp(-t / max(decay, 1e-4))
    e = a * d
    if release:
        r = int(release * SR)
        if r < n:
            e[-r:] *= np.linspace(1, 0, r)
    return e


def lowpass(x, cutoff):
    """Brick-ish lowpass in the frequency domain (fine for whole stems or notes)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / max(cutoff, 20)) ** 4)
    return np.fft.irfft(X, len(x))


def highpass(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (max(cutoff, 20) / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


def saw(freq, dur, detune=0.0):
    t = np.arange(int(dur * SR)) / SR
    f = freq * (1 + detune)
    return 2 * ((t * f) % 1) - 1


def sine(freq, dur, phase=0.0):
    t = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * freq * t + phase)


def note(n):
    """MIDI note → Hz."""
    return 440 * 2 ** ((n - 69) / 12)


# ---------------------------------------------------------------- instruments
def kick():
    d = 0.42
    t = np.arange(int(d * SR)) / SR
    f = 46 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.003) * 0.25
    return np.tanh((body + click) * 1.6) * 0.9


def clap():
    d = 0.3
    n = int(d * SR)
    x = rng.standard_normal(n)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / (0.012 if k < 2 else 0.11)) * (0.7 if k < 2 else 1)
    x = highpass(lowpass(x * e, 4200), 900)
    return x / (np.abs(x).max() + 1e-9) * 0.65


def hat(open_=False):
    d = 0.18 if open_ else 0.05
    x = highpass(rng.standard_normal(int(d * SR)), 7500) * env(int(d * SR), 0.001, 0.06 if open_ else 0.014)
    return x / (np.abs(x).max() + 1e-9) * (0.32 if open_ else 0.26)


def shaker():
    d = 0.07
    x = highpass(rng.standard_normal(int(d * SR)), 5500) * env(int(d * SR), 0.01, 0.02)
    return x / (np.abs(x).max() + 1e-9) * 0.13


def bass_note(midi, dur):
    s = saw(note(midi), dur) * 0.6 + sine(note(midi), dur) * 0.6
    s = lowpass(s, 700) * env(len(s), 0.004, 0.16, 0.25, 0.03)
    return np.tanh(s * 1.8) * 0.5


def pluck(midi, dur=0.32, bright=4200):
    s = saw(note(midi), dur) * 0.5 + saw(note(midi), dur, 0.006) * 0.5
    s = lowpass(s, bright) * env(len(s), 0.002, 0.11)
    return s * 0.42


def chord_pad(midis, dur, cutoff=2600):
    s = sum(saw(note(m), dur, d) for m in midis for d in (-0.004, 0.0, 0.005))
    s = lowpass(s / (len(midis) * 3), cutoff) * env(int(dur * SR), 0.03, 0.9, 0.55, 0.08)
    return s * 0.55


def bell(midi, dur=1.4):
    s = sine(note(midi), dur) + 0.4 * sine(note(midi) * 2.01, dur) + 0.18 * sine(note(midi) * 3.98, dur)
    return s * env(int(dur * SR), 0.003, 0.45) * 0.32


def noise_riser(dur):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    steps = 24
    for k in range(steps):
        a, b = k * n // steps, (k + 1) * n // steps
        out[a:b] = highpass(x[a:b], 300 + 9000 * (k / steps) ** 2)
    return out * np.linspace(0, 1, n) ** 2 * 0.28


def impact():
    d = 2.2
    t = np.arange(int(d * SR)) / SR
    f = 38 + 60 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    air = lowpass(rng.standard_normal(len(t)), 1800) * np.exp(-t / 0.25) * 0.4
    return np.tanh((boom + air) * 1.4) * 0.8


# Progression in F major: F – C – Dm – B♭ (I–V–vi–IV), one chord per bar
ROOTS = [41, 36, 38, 34]  # bass MIDI: F2, C2, D2, B♭1
CHORDS = [[65, 69, 72], [64, 67, 72], [62, 65, 69], [62, 65, 70]]  # F, C/E, Dm, B♭
HOOK = [77, 76, 72, 74, 72, 69, 72, 74]  # 8ths over a bar: a bright, singable hook


def build_music():
    drums = np.zeros(N)
    bass = np.zeros(N)
    keys = np.zeros(N)
    lead = np.zeros(N)
    fx = np.zeros(N)
    K, CL, HC, HO, SH = kick(), clap(), hat(), hat(True), shaker()

    total_beats = BARS * 4
    for b in range(total_beats):
        bar, beat = divmod(b, 4)
        t = t_of_beat(b)
        frozen = bar in (FREEZE_BAR, FREEZE_BAR + 1) and b < NOBODY_BEAT
        tension = CHECKOUT <= bar < CHECKOUT + 2 and b < CHECKOUT_RELEASE
        build = bar in (CARD_DROP - 2, CARD_DROP - 1)
        end = bar >= FINAL_BAR
        if end:
            continue
        # Kick on every beat (four on the floor), thinned out during the freeze and the checkout tension
        if not frozen and not (tension and beat % 2):
            at(drums, t, K, 0.95 if not build else 0.8)
        # Claps on 2 and 4
        if beat in (1, 3) and not frozen and not tension:
            at(drums, t, CL, 0.8)
        # Hats: 8ths from the intro, open hats on the offbeat
        if bar >= INTRO and not frozen:
            at(drums, t + BEAT / 2, HO if (bar >= SPLIT and not tension) else HC, 0.9)
            if bar >= INVITE:
                at(drums, t, HC, 0.5)
        # Shaker 16ths once the invites go out
        if bar >= INVITE and not frozen and not tension:
            for s in range(4):
                at(drums, t + s * BEAT / 4, SH, 1.0 if s % 2 else 0.6)
        # Snare-style clap roll into the drop
        if bar == CARD_DROP - 1:
            for s in range(4 if beat < 2 else 8):
                at(drums, t + s * BEAT / (4 if beat < 2 else 8), CL, 0.25 + 0.15 * beat)

    for bar in range(BARS):
        if bar >= FINAL_BAR:
            break
        t0 = bar * BAR
        root = ROOTS[bar % 4]
        chord = CHORDS[bar % 4]
        frozen = bar in (FREEZE_BAR, FREEZE_BAR + 1)
        tension = CHECKOUT <= bar < CHECKOUT + 2
        # Bass: bouncy offbeat 8ths, octave jump on the last one
        if not frozen:
            for e in range(8):
                if e % 2 == 1 or bar >= SPLIT:
                    m = root + (12 if e == 7 else 0)
                    at(bass, t0 + e * BEAT / 2, bass_note(m, BEAT / 2 * 0.95), 1.0 if e % 2 else 0.6)
        # Chords: stabs early on, a pumping pad from the split onwards
        if bar >= SPLIT and not tension:
            at(keys, t0, chord_pad(chord, BAR * 0.98, 3200 if bar >= CARD_DROP else 2200), 1.0)
        elif not frozen:
            for s in (0.5, 1.5, 2.5, 3.25):
                at(keys, t0 + s * BEAT, chord_pad([n + 12 for n in chord], BEAT * 0.35, 3800), 0.8)
        # Hook: from the payback scene, and full on the drop and the close
        if (PAYBACK + 2 <= bar < CONCEPT) or (CARD_DROP <= bar < CHECKOUT) or (CLOSE <= bar < FINAL_BAR) or bar < FREEZE_BAR:
            for e, m in enumerate(HOOK):
                if bar < FREEZE_BAR and e % 2:
                    continue
                at(lead, t0 + e * BEAT / 2, pluck(m + (0 if bar % 2 == 0 else (-2 if e > 5 else 0))), 0.9)
        # Arp 16ths of the chord during the payback and the drop: "satisfying pulses"
        if PAYBACK <= bar < CONCEPT or CARD_DROP <= bar < CHECKOUT:
            seq = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12]
            for s in range(16):
                at(lead, t0 + s * BEAT / 4, pluck(seq[s % 4], 0.12, 6000), 0.35)
        # Checkout tension: a held, filtered chord with a pulse
        if tension:
            for s in range(8):
                at(keys, t0 + s * BEAT / 2, chord_pad(chord, BEAT / 2 * 0.9, 900 + 300 * s), 0.7)

    # Moments
    at(fx, t_of_beat(NOBODY_BEAT), chord_pad([53, 57, 60, 65, 69], 1.2, 5000) * 1.4, 1.0)  # "Nobody's paid" stab
    at(fx, t_of_beat(NOBODY_BEAT), K, 1.0)
    at(fx, (CARD_DROP - 2) * BAR, noise_riser(BAR * 2), 1.0)  # riser into the card
    at(fx, CARD_DROP * BAR, impact(), 1.0)  # the drop
    at(fx, t_of_beat(CHECKOUT_RELEASE), chord_pad([65, 69, 72, 77], 1.4, 6000), 1.1)  # checkout release
    for i, m in enumerate([77, 81, 84]):  # "Sorted." sparkle
        at(fx, SORTED_BAR * BAR + i * BEAT / 4, bell(m, 0.9), 0.8)
    # Sonic logo: three rising bells, then the final hit and chord that ring to the end
    for i, m in enumerate([72, 76, 79, 84]):
        at(fx, BRAND_BAR * BAR + i * BEAT / 2, bell(m, 1.6), 1.0)
    at(fx, FINAL_BAR * BAR, impact() * 0.7, 1.0)
    at(fx, FINAL_BAR * BAR, chord_pad([53, 65, 69, 72, 77], BAR * 1.2, 4200) * 1.3, 1.0)
    at(fx, FINAL_BAR * BAR, K, 1.0)

    # Sidechain pump on the keys from each kick
    pump = np.ones(N)
    shape = 1 - 0.55 * np.exp(-np.arange(int(BEAT * SR)) / SR / 0.09)
    for b in range(BARS * 4):
        i = int(t_of_beat(b) * SR)
        j = min(N, i + len(shape))
        pump[i:j] = np.minimum(pump[i:j], shape[: j - i])
    keys *= pump
    lead *= 0.6 + 0.4 * pump

    mix = drums * 0.9 + bass * 0.95 + keys * 0.55 + lead * 0.5 + fx * 0.8
    # Gentle master: soft clip, then peak-normalise to -1 dBFS
    mix = np.tanh(mix * 1.1)
    mix /= np.abs(mix).max() + 1e-9
    mix *= 10 ** (-1 / 20)
    # Width: a few ms of delay on the right channel for the keys and lead only
    d = int(0.011 * SR)
    side = np.zeros(N)
    side[d:] = (keys * 0.55 + lead * 0.5)[:-d]
    left = mix
    right = mix * 0.92 + np.tanh(side) * 0.08
    right /= max(1.0, np.abs(right).max() / 0.89)
    # Trim to the film's length (the final chord has decayed by then)
    n = int(LENGTH * SR)
    fade = int(0.05 * SR)
    left, right = left[:n].copy(), right[:n].copy()
    left[-fade:] *= np.linspace(1, 0, fade)
    right[-fade:] *= np.linspace(1, 0, fade)
    return np.stack([left, right], axis=1)


# ---------------------------------------------------------------- sound effects
def sfx():
    out = {}
    # Incoming message: a short, rounded "tick"
    s = sine(1320, 0.09) * env(int(0.09 * SR), 0.002, 0.025) + sine(1980, 0.09) * env(int(0.09 * SR), 0.002, 0.015) * 0.4
    out["message"] = s * 0.5
    # Select / tap: a soft wooden click
    s = lowpass(rng.standard_normal(int(0.06 * SR)), 2400) * env(int(0.06 * SR), 0.001, 0.008) + sine(520, 0.06) * env(int(0.06 * SR), 0.001, 0.02) * 0.6
    out["tap"] = s * 0.6
    # Whoosh: filtered noise sweeping up then down (share, transitions)
    n = int(0.42 * SR)
    x = rng.standard_normal(n)
    w = np.zeros(n)
    for k in range(16):
        a, b = k * n // 16, (k + 1) * n // 16
        c = 600 + 5200 * np.sin(np.pi * k / 15)
        w[a:b] = lowpass(x[a:b], c)
    out["whoosh"] = w * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.45
    # Pop: an avatar or a link landing
    t = np.arange(int(0.12 * SR)) / SR
    f = 380 + 900 * np.exp(-t / 0.02)
    out["pop"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.04) * 0.5
    # Confirm: two notes up (RSVP going, contribution confirmed)
    s = np.zeros(int(0.4 * SR))
    for i, m in enumerate([84, 88]):
        b = bell(m, 0.3)
        k = int(i * 0.07 * SR)
        s[k:k + len(b)] += b[: len(s) - k]
    out["confirm"] = s * 1.3
    # Success: a bright major triad arpeggio (payment done, checkout)
    s = np.zeros(int(1.0 * SR))
    for i, m in enumerate([77, 81, 84, 89]):
        b = bell(m, 0.8)
        k = int(i * 0.055 * SR)
        s[k:k + len(b)] += b[: len(s) - k]
    out["success"] = s * 1.1
    # Card reveal: a low hit plus a glassy shimmer (no cash register)
    hit = impact()[: int(1.6 * SR)] * 0.6
    shimmer = sum(sine(note(m), 1.6) * env(int(1.6 * SR), 0.01, 0.6) for m in (96, 100, 103, 108)) * 0.06
    out["card"] = hit + shimmer
    return out


def write_wav(path, data):
    data = np.asarray(data, dtype=np.float64)
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "sfx"), exist_ok=True)
    music = build_music()
    write_wav(os.path.join(OUT, "music.wav"), music)
    print(f"music.wav  {len(music) / SR:.2f}s  peak {np.abs(music).max():.2f}")
    for name, s in sfx().items():
        write_wav(os.path.join(OUT, "sfx", f"{name}.wav"), s / max(1.0, np.abs(s).max() / 0.9))
        print(f"sfx/{name}.wav  {len(s) / SR:.2f}s")
