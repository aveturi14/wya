import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are phone-only; on web these do nothing
const native = Platform.OS !== 'web';

export const haptics = {
  tap: () => { if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  select: () => { if (native) Haptics.selectionAsync().catch(() => {}); },
  success: () => { if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warning: () => { if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};
