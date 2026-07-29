import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import * as api from '@/api/endpoints';
import { useAuth } from '@/auth/AuthContext';
import { ErrorText } from '@/components/ErrorText';
import { styles } from '@/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.login(email.trim(), password),
    onSuccess: (result) => signIn(result.token, result.user),
  });

  const canSubmit = email.trim().length > 0 && password.length > 0 && !mutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Log in</Text>

        <ErrorText message={mutation.error?.message} />

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
            autoComplete="current-password"
          />
        </View>

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          disabled={!canSubmit}
          onPress={() => mutation.mutate()}
        >
          <Text style={styles.buttonText}>{mutation.isPending ? 'Logging in…' : 'Log in'}</Text>
        </Pressable>

        <Text style={styles.muted}>
          No account? <Link href="/signup" style={styles.link}>Sign up</Link>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
