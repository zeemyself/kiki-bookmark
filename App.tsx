import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import { Auth0Provider } from 'react-native-auth0';
import { RootNavigator } from './src/navigation';
import { DATABASE_NAME, migrateDbIfNeeded } from './src/db';
import { AUTH0_CONFIG } from './src/auth';

export default function App() {
  return (
    <Auth0Provider domain={AUTH0_CONFIG.domain} clientId={AUTH0_CONFIG.clientId}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </SQLiteProvider>
      </SafeAreaProvider>
    </Auth0Provider>
  );
}
