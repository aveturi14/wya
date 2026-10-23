import { Easing, interpolate, spring } from 'remotion';
import { FPS } from '../data/demo';

/** 0 → 1 with a confident, slightly elastic settle (the app's press springs, slowed for video). */
export const pop = (frame: number, at: number, stiffness = 140, damping = 14) =>
  spring({ frame: frame - at, fps: FPS, config: { stiffness, damping, mass: 0.9 } });

/** 0 → 1 with no overshoot, for things that should glide rather than bounce. */
export const glide = (frame: number, at: number, duration = 18) =>
  interpolate(frame, [at, at + duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1) });

/** 1 → 0 ending at `end`. */
export const leave = (frame: number, end: number, duration = 10) =>
  interpolate(frame, [end - duration, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });

export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;

/** Counts up between two values over a span, easing out (for money). */
export const countUp = (frame: number, at: number, duration: number, from: number, to: number) =>
  Math.round(lerp(glide(frame, at, duration), from, to));
