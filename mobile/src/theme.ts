import { StyleSheet } from 'react-native';

export const colors = {
  green: '#2f6b46',
  ink: '#1c2119',
  muted: '#6b7268',
  bg: '#f8f7f3',
  line: '#ddded7',
  error: '#a32d1e',
  errorBg: '#fbeae7',
  white: '#ffffff',
};

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    fontSize: 16,
    color: colors.ink,
  },
  muted: {
    fontSize: 15,
    color: colors.muted,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.green,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: colors.green,
    fontSize: 15,
  },
  error: {
    backgroundColor: colors.errorBg,
    color: colors.error,
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  scientific: {
    fontSize: 17,
    fontWeight: '600',
    fontStyle: 'italic',
    color: colors.ink,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: colors.line,
  },
  attribution: {
    marginTop: 8,
    fontSize: 13,
    color: colors.muted,
  },
});
