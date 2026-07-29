import { Image, Linking, Pressable, Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import type { IdentifyResponse } from '@/api/types';
import { styles } from '@/theme';

/**
 * PlantNet's free tier requires its attribution wherever results are shown, so
 * it renders on the no-match path too. The fake dev provider sends none, because
 * nothing was called and crediting anyone would be a lie.
 */
function AttributionLine({ attribution }: Pick<IdentifyResponse, 'attribution'>) {
  if (!attribution) return null;
  return (
    <Pressable onPress={() => Linking.openURL(attribution.url)}>
      <Text style={styles.attribution}>{attribution.text}</Text>
    </Pressable>
  );
}

export function Candidates({ result }: { result: IdentifyResponse }) {
  return (
    <View style={{ gap: 12 }}>
      <Image
        source={{ uri: mediaUrl(result.image_url) }}
        style={styles.photo}
        resizeMode="cover"
        accessibilityLabel="The plant you photographed"
      />

      {result.candidates.length === 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.body}>
            No match. That happens with unusual plants and photos that are hard to read.
          </Text>
          <Text style={styles.muted}>Try another angle, or a close-up of a single leaf.</Text>
        </View>
      ) : (
        result.candidates.map((candidate) => (
          <View key={candidate.scientific_name} style={styles.card}>
            <Text style={styles.scientific}>{candidate.scientific_name}</Text>
            {candidate.common_names.length > 0 && (
              <Text style={styles.muted}>{candidate.common_names.join(', ')}</Text>
            )}
            <Text style={styles.muted}>{candidate.confidence_percent}% match</Text>
          </View>
        ))
      )}

      <AttributionLine attribution={result.attribution} />
    </View>
  );
}
