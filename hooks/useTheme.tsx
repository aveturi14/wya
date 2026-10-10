import { Theme, ThemeName, Themes } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'wya.themePreference';

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: Themes.light,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (saved === 'light' || saved === 'dark' || saved === 'system') setPreferenceState(saved); })
      .catch(() => {});
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  };

  const name: ThemeName = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  return (
    <ThemeContext.Provider value={{ theme: Themes[name], preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Theme-aware StyleSheet: define styles once as a function of the theme,
 * call the returned hook in a component. Each theme's sheet is built once.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  const cache = new Map<ThemeName, T>();
  return function useStyles(): T {
    const { theme } = useTheme();
    let styles = cache.get(theme.name);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme.name, styles);
    }
    return styles;
  };
}
