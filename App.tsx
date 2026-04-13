import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { AlertProvider } from './src/context/AlertContext';
import RootNavigator from './src/navigation/RootNavigator';
import { AppUpdater } from './src/components/AppUpdater';
import * as Font from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { registerForPushNotificationsAsync } from './src/utils/notificationService';
import { TimerProvider } from './src/context/TimerContext';
import { AnimatedSplashScreen } from './src/components/AnimatedSplashScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might cause some cross-platform issues */
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Load fonts required for icons
        await Font.loadAsync(MaterialCommunityIcons.font);
        
        // Register for notifications
        await registerForPushNotificationsAsync();

        // Small prep delay
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the native splash screen to hide so our animated one can take over
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady || !splashFinished) {
    return (
      <View style={styles.container}>
        {!appIsReady ? (
           // While native splash is clearing, we show a matching background
           <View style={styles.fullBackground} />
        ) : (
          <AnimatedSplashScreen onFinish={() => setSplashFinished(true)} />
        )}
      </View>
    );
  }

  return (
    <AlertProvider>
      <AuthProvider>
        <AppUpdater>
          <TimerProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </TimerProvider>
        </AppUpdater>
      </AuthProvider>
    </AlertProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullBackground: {
    flex: 1,
    backgroundColor: '#3E315A', // Match colors.primary exactly
  }
});
