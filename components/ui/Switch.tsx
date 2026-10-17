import { useTheme } from '@/hooks/useTheme';
import { Platform, Switch as RNSwitch, SwitchProps } from 'react-native';

/** The system switch in wya's colours: green when on, a grey track when off, a white knob. */
export default function Switch(props: SwitchProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <RNSwitch
      trackColor={{ false: c.chipStrong, true: c.success }}
      thumbColor={c.thumb}
      ios_backgroundColor={c.chipStrong}
      // React Native Web draws its own track; this keeps the knob white on it too
      {...(Platform.OS === 'web' ? ({ activeThumbColor: c.thumb } as object) : {})}
      {...props}
    />
  );
}
