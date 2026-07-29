import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import * as api from '@/api/endpoints';
import { useAuth } from '@/auth/AuthContext';
import { ErrorText } from '@/components/ErrorText';
import { styles } from '@/theme';

const MIN_PASSWORD_LENGTH = 10;

/** The device already knows its zone, so reminders land at noon where the user is. */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function SignupScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const timezone = deviceTimezone();

  const mutation = useMutation({
    mutationFn: () => api.signup(email.trim(), password, timezone),
    onSuccess: (result) => signIn(result.token, result.user),
  });

  // Validate on press, not by disabling the button — a dimmed button that does
  // nothing reads as a broken app, with no way to find out what it wants.
  function submit() {
    if (email.trim().length === 0) return setProblem('Enter your email address.');
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setProblem(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    setProblem(null);
    mutation.mutate();
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Sign up</Text>

        <ErrorText message={problem ?? mutation.error?.message} />

        <View>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
          />
        </View>

        <View>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <Text style={styles.muted}>At least {MIN_PASSWORD_LENGTH} characters.</Text>
        </View>

        <Text style={styles.muted}>Reminders will arrive at noon in {timezone}.</Text>

        <Pressable
          style={[styles.button, mutation.isPending && styles.buttonDisabled]}
          disabled={mutation.isPending}
          onPress={submit}
        >
          <Text style={styles.buttonText}>
            {mutation.isPending ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        <Text style={styles.muted}>
          Already have an account? <Link href="/login" style={styles.link}>Log in</Link>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
