import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.green,
        headerTitleStyle: { color: colors.ink },
      }}
    />
  );
}
