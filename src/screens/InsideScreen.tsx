/** Author: BinaryBeast1209 */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeText } from '../ui/SafeText';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, textBase } from '../theme';

export function InsideScreen() {
  const { lock, resetWithPin, record } = useAuth();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');

  const reset = async () => {
    const ok = await resetWithPin(pin);
    setMessage(ok ? '' : 'PIN did not match. Enrollment was not cleared.');
  };

  return (
    <View style={styles.page}>
      <SafeText style={styles.kicker}>Unlocked</SafeText>
      <SafeText style={styles.title}>You're in</SafeText>
      <SafeText style={styles.sub}>
        {`Face authentication is working on this device. The eye-scan and Tips screens come next.${
          record?.sampleCount ? ` Enrolled from ${record.sampleCount} photos.` : ''
        }`}
      </SafeText>

      <Pressable style={styles.button} onPress={lock}>
        <SafeText style={styles.buttonText}>Lock now</SafeText>
      </Pressable>

      <SafeText style={styles.label}>Reset enrollment</SafeText>
      <SafeText style={styles.hint}>Enter your PIN to wipe the saved face and start over.</SafeText>
      <TextInput
        value={pin}
        onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry
        placeholder="PIN"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Pressable
        style={[styles.secondary, pin.length !== 4 && styles.disabled]}
        onPress={reset}
        disabled={pin.length !== 4}
      >
        <SafeText style={styles.secondaryText}>Clear my face and PIN</SafeText>
      </Pressable>
      {message ? <SafeText style={styles.error}>{message}</SafeText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    paddingTop: 72,
    gap: 12,
  },
  kicker: {
    ...textBase,
    color: colors.success,
    fontWeight: '600',
    fontSize: 12,
  },
  title: {
    ...textBase,
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    ...textBase,
    fontSize: 16,
    lineHeight: 22,
    color: colors.secondary,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    ...textBase,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    ...textBase,
    marginTop: 28,
    color: colors.text,
    fontWeight: '700',
    fontSize: 18,
  },
  hint: {
    ...textBase,
    color: colors.secondary,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
  },
  secondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    ...textBase,
    color: colors.warning,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  error: {
    color: colors.warning,
  },
});
