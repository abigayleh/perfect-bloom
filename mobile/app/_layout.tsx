import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
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

function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) return <Loading />;

  // Guarded, not redirected: a redirect only runs after render, so the
  // signed-out app mounted (app) and threw in useAuthToken first.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* useSuspense so no screen can query a database that has not migrated yet. */}
      <Suspense fallback={<Loading />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </AuthProvider>
          </QueryClientProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
