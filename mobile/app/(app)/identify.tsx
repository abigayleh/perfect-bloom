import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import * as api from '@/api/endpoints';
import { useAuthToken } from '@/auth/AuthContext';
import { Candidates } from '@/components/Candidates';
import { ErrorText } from '@/components/ErrorText';
import { colors, styles } from '@/theme';

const MAX_PHOTOS = 5;

function toUris(assets: ImagePicker.ImagePickerAsset[]): string[] {
  return assets.slice(0, MAX_PHOTOS).map((asset) => asset.uri);
}

export default function IdentifyScreen() {
  const token = useAuthToken();
  // Kept so the results can show the photo the user picked, and so that URI can
  // travel to the add screen. Nothing leaves the picker's cache until a save.
  const [uris, setUris] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (picked: string[]) => api.identify(token, picked),
  });

  const run = (picked: string[]) => {
    setUris(picked);
    mutation.mutate(picked);
  };

  // exif: false keeps GPS off the wire. The API strips it again regardless —
  // this is the belt, that's the braces.
  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      exif: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) run(toUris(result.assets));
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      exif: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) run(toUris(result.assets));
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Identify' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.muted}>
          Up to {MAX_PHOTOS} photos of the same plant. Leaves and flowers work best.
        </Text>

        <Pressable
          style={[styles.button, mutation.isPending && styles.buttonDisabled]}
          disabled={mutation.isPending}
          onPress={takePhoto}
        >
          <Text style={styles.buttonText}>Take a photo</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, mutation.isPending && styles.buttonDisabled]}
          disabled={mutation.isPending}
          onPress={pickFromLibrary}
        >
          <Text style={styles.secondaryButtonText}>Choose from library</Text>
        </Pressable>

        <ErrorText message={mutation.error?.message} />

        {mutation.isPending && (
          <View style={{ paddingVertical: 24, gap: 8, alignItems: 'center' }}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.muted}>Looking it up…</Text>
          </View>
        )}

        {mutation.data && !mutation.isPending && uris[0] && (
          <Candidates result={mutation.data} photoUri={uris[0]} />
        )}
      </ScrollView>
    </View>
  );
}
