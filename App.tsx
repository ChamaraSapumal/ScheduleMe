import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AlertProvider } from './src/context/AlertContext';
import RootNavigator from './src/navigation/RootNavigator';
import { AppUpdater } from './src/components/AppUpdater';

export default function App() {
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
