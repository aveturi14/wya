import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

/** Sets the browser tab title on web ("Seed Dinner Party · wya"); does nothing on phones. */
export function usePageTitle(title: string | null | undefined) {
  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web' && title) document.title = `${title} · wya`;
  }, [title]));
}
