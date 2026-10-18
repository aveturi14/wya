import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Gesture, PointerType } from 'react-native-gesture-handler';

/**
 * Desktop controls for the full-screen viewers (album and lightbox). Phones and
 * touch screens already swipe through the paging list; a mouse can't, so on the
 * web this adds ←/→ and Esc on the keyboard and a drag that only listens to the
 * mouse (touch keeps scrolling the list, so it never moves twice). It also loads
 * the photos either side ahead of time, so the next one is sharp when it arrives.
 */
export function useGalleryControls({ open, index, count, go, onClose, neighbours }: {
  open: boolean;
  index: number;
  count: number;
  go: (to: number) => void;
  onClose: () => void;
  neighbours?: (string | undefined)[];
}) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && index < count - 1) { e.preventDefault(); go(index + 1); }
      else if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); go(index - 1); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, count, go, onClose]);

  const ahead = (neighbours ?? []).filter((u): u is string => !!u);
  useEffect(() => {
    if (open && ahead.length) Image.prefetch(ahead).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ahead.join('|')]);

  const drag = Gesture.Pan()
    .enabled(Platform.OS === 'web' && open)
    .runOnJS(true)
    .activeOffsetX([-12, 12])
    .onEnd((e) => {
      if (e.pointerType !== PointerType.MOUSE) return;
      if ((e.translationX < -60 || e.velocityX < -600) && index < count - 1) go(index + 1);
      else if ((e.translationX > 60 || e.velocityX > 600) && index > 0) go(index - 1);
    });

  return { drag, showArrows: Platform.OS === 'web' };
}
