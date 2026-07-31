import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
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
      <ActivityIndicator color={colors.leaf} />
    </View>
  );
}

/**
 * No auth gate: the collection lives on this device. Two things are worth waiting
 * for — the schema migration, and the typefaces, since the design leans on
 * Newsreader hard enough that a fallback flash would read as a bug.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  return (
    <SafeAreaProvider>
      {/* useSuspense so no screen can query a database that has not migrated yet. */}
      <Suspense fallback={<Loading />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            {fontsLoaded ? <Stack screenOptions={{ headerShown: false }} /> : <Loading />}
          </QueryClientProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}