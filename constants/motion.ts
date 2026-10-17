/**
 * Shared motion, so the app moves with one rhythm (Phase 9).
 * Reanimated skips springs and timings when Reduce Motion is on (its default,
 * ReduceMotion.System); looping effects check useReducedMotion() themselves.
 */
export const Motion = {
  // Press feedback: a quick squeeze down, a softer settle back
  press: { damping: 15, stiffness: 400 },
  release: { damping: 12, stiffness: 300 },
  // Durations in ms. Exits run at about two thirds of the matching entrance.
  fast: 150,
  base: 220,
  slow: 320,
  // List entrances: each card starts this much after the one before (capped at 6)
  stagger: 50,
  // Poster effects (9.3): the glow breathes slowly; stickers wobble now and then
  glowBreathe: 7000,
  stickerWobble: 3200,
};
