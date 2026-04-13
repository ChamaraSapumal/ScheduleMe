import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { AlertProvider } from './src/context/AlertContext';
import RootNavigator from './src/navigation/RootNavigator';
import { AppUpdater } from './src/components/AppUpdater';
import * as Font from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might cause some cross-platform issues */
});

export default function App() {
  useEffect(() => {
    async function prepare() {
      try {
        // Load fonts required for icons
        await Font.loadAsync(MaterialCommunityIcons.font);
        
        // Show splash for at least 1.5 seconds
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the splash screen to hide
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  return (
    <AlertProvider>
      <AuthProvider>
        <AppUpdater>
          <StatusBar style="light" />
          <RootNavigator />
        </AppUpdater>
      </AuthProvider>
    </AlertProvider>
  );
}
