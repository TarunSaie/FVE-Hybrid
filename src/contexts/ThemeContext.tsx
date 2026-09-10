import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors, getThemeColors } from '@/constants/colors';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'fitverse-mobile-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemColorScheme(): ResolvedTheme {
  const scheme = Appearance.getColorScheme();
  return scheme === 'light' ? 'light' : 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [systemScheme, setSystemScheme] = useState<ResolvedTheme>(getSystemColorScheme);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeState(saved as ThemeMode);
        }
      } catch {
        // Fallback to default dark
      } finally {
        setIsLoaded(true);
      }
    }
    loadTheme();
  }, []);

  // Listen for OS appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
      setSystemScheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => subscription.remove();
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemScheme;
    }
    return theme;
  }, [theme, systemScheme]);

  const isDark = resolvedTheme === 'dark';
  const colors = useMemo(() => getThemeColors(isDark), [isDark]);

  const setTheme = useCallback(async (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  }, [resolvedTheme, setTheme]);

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark,
      colors,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, isDark, colors, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return safe fallback if used outside provider
    return {
      theme: 'dark',
      resolvedTheme: 'dark',
      isDark: true,
      colors: darkColors,
      setTheme: async () => {},
      toggleTheme: async () => {},
    };
  }
  return context;
}
