import { Text } from 'react-native';

import { styles } from '@/theme';

/**
 * The one way this app surfaces failures. Inline, never Alert.alert — an alert
 * blocks and can't be styled consistently.
 */
export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}
