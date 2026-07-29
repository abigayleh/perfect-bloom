import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { configureNotificationHandler } from '@/notifications';
import { colors, styles } from '@/theme';

const queryClient = new QueryClient();

configureNotificationHandler();

function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.green} />
    </View>
  );
}

/**
 * No auth gate any more: the collection lives on this device, so there is nothing
 * to sign in to. The only thing worth waiting for is the schema migration.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* useSuspense so no screen can query a database that has not migrated yet. */}
      <Suspense fallback={<Loading />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
          </QueryClientProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
