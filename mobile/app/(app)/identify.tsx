import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as api from '@/api/endpoints';
import { Candidates } from '@/components/Candidates';
import { ErrorText } from '@/components/ErrorText';
import { colors, fonts, styles as t } from '@/theme';

const MAX_PHOTOS = 5;

function toUris(assets: ImagePicker.ImagePickerAsset[]): string[] {
  return assets.slice(0, MAX_PHOTOS).map((asset) => asset.uri);
}

export default function IdentifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Kept so results can show the photo the user picked, and so that URI can
  // travel to the add screen. Nothing leaves the picker's cache until a save.
  const [uris, setUris] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (picked: string[]) => api.identify(picked),
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

  // The design gives identification its own dark room while it waits.
  if (mutation.isPending) {
    return (
      <View style={s.night}>
        <ActivityIndicator size="large" color={colors.leafBright} />
        <Text style={s.nightTitle}>Consulting the herbarium…</Text>
        <Text style={s.nightMeta}>
          {uris.length} {uris.length === 1 ? 'photo' : 'photos'} · PlantNet
        </Text>
      </View>
    );
  }

  return (
    <View style={t.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 26,
          paddingBottom: 40,
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={s.back}>← Back</Text>
        </Pressable>

        {mutation.data ? (
          <View style={s.results}>
            <Candidates result={mutation.data} photoUri={uris[0]} />
            <Pressable style={t.ghostButton} onPress={() => mutation.reset()}>
              <Text style={t.ghostButtonText}>None of these are it</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.intro}>
            <Text style={t.title}>Show me a leaf.</Text>
            <Text style={t.bodyMuted}>
              Fill the frame with one leaf. Up to {MAX_PHOTOS} photos of the same plant —
              more angles, better guess.
            </Text>

            <ErrorText message={mutation.error?.message} />

            <View style={s.actions}>
              <Pressable style={t.button} onPress={takePhoto}>
                <Text style={t.buttonText}>Take a photo</Text>
              </Pressable>
              <Pressable style={t.ghostButton} onPress={pickFromLibrary}>
                <Text style={t.ghostButtonText}>Choose from library</Text>
              </Pressable>
              <Pressable style={t.dashedButton} onPress={() => router.replace('/add')}>
                <Text style={t.ghostButtonText}>Add it by name instead</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  back: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  intro: { marginTop: 16, gap: 14 },
  actions: { marginTop: 10, gap: 12 },
  results: { marginTop: 16, gap: 14 },

  night: {
    flex: 1,
    backgroundColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  nightTitle: { fontFamily: fonts.serif, fontSize: 24, color: '#F2F2EB' },
  nightMeta: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#7A8C7D',
  },
});