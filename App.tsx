import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import {
  Orbitron_700Bold,
  Orbitron_900Black,
} from '@expo-google-fonts/orbitron';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { DialogProvider } from '@/contexts/DialogContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// Keep native splash screen visible until fonts or our initial dark UI is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    Orbitron_700Bold,
    Orbitron_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    // Safety fallback: Never keep the splash screen visible for more than 2 seconds
    const timer = setTimeout(() => {
      setTimedOut(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 2000);

    if (fontsLoaded || fontError) {
      clearTimeout(timer);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  const isReady = fontsLoaded || fontError || timedOut;

  // While initializing, display dark background until ready
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050505' }}>
        <StatusBar style="light" />
      </View>
    );
  }

  const navFonts = fontsLoaded
    ? {
        regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const },
        medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const },
        bold: { fontFamily: 'Rajdhani_700Bold', fontWeight: '700' as const },
        heavy: { fontFamily: 'Orbitron_900Black', fontWeight: '900' as const },
      }
    : {
        regular: { fontFamily: 'sans-serif', fontWeight: '400' as const },
        medium: { fontFamily: 'sans-serif-medium', fontWeight: '500' as const },
        bold: { fontFamily: 'sans-serif', fontWeight: '700' as const },
        heavy: { fontFamily: 'sans-serif', fontWeight: '900' as const },
      };

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#050505' }}>
        <QueryClientProvider client={queryClient}>
          <DialogProvider>
            <AuthProvider>
              <NavigationContainer
                theme={{
                  dark: true,
                  colors: {
                    primary: '#EFA100',
                    background: '#050505',
                    card: '#0A0A0A',
                    text: '#FFFFFF',
                    border: 'rgba(239, 161, 0, 0.25)',
                    notification: '#EF4444',
                  },
                  fonts: navFonts,
                }}
              >
                <StatusBar style="light" />
                <RootNavigator />
              </NavigationContainer>
            </AuthProvider>
          </DialogProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
