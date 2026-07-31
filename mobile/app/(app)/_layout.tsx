import { Stack } from 'expo-router';

import { colors } from '@/theme';

/**
 * No native headers: every screen in the design draws its own back control over
 * a full-bleed photo or a serif title, so a bar on top would fight it.
 */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  );
}
