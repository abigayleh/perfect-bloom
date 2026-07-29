import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { styles } from '@/theme';

export default function CollectionScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Your plants' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.muted}>Signed in as {user?.email}</Text>

        <Text style={styles.body}>
          Your collection is empty. Saving plants arrives in the next build.
        </Text>

        <Link href="/identify" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Identify a plant</Text>
          </Pressable>
        </Link>

        <Pressable style={styles.secondaryButton} onPress={signOut}>
          <Text style={styles.secondaryButtonText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
