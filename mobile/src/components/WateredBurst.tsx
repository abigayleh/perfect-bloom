import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

/** Completion animation for a watering. Built on RN's Animated — no extra dependency. */
export function WateredBurst({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.delay(450),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [scale, opacity, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.burst, { opacity, transform: [{ scale }] }]}
      accessibilityLabel="Watered"
    >
      <Text style={styles.drop}>💧</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drop: {
    fontSize: 96,
  },
});
