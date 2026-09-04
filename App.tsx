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
import { AuthProvider } from '@/contexts/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { FVELoading } from '@/components/common/FVELoading';

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
  const [fontsLoaded] = useFonts({
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

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // While fonts are loading, display our luxury animated dark-gold splash screen
  // instead of a blank white screen!
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050505' }}>
        <StatusBar style="light" />
        <FVELoading message="INITIALIZING FITVERSE ELITE" />
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#050505' }}>
      <QueryClientProvider client={queryClient}>
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
              fonts: {
                regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
                medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
                bold: { fontFamily: 'Rajdhani_700Bold', fontWeight: '700' },
                heavy: { fontFamily: 'Orbitron_900Black', fontWeight: '900' },
              },
            }}
          >
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
