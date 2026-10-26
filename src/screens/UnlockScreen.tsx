/** Author: BinaryBeast1209 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { debugLog } from '../debug/log';
import { useFaceEngine } from '../auth/FaceEngine';
import { loadFaceModels } from '../auth/face';
import { PhoneCamera, type PhoneCameraHandle } from '../components/PhoneCamera';
import { colors, radius } from '../theme';
import { Button } from '../ui/Button';
import { FaceWell } from '../ui/FaceWell';
import { Logo } from '../ui/Logo';
import { Screen } from '../ui/Screen';
import { Type } from '../ui/Type';
import { useLayout } from '../ui/useLayout';

export function UnlockScreen() {
  const { unlockWithFace, unlockWithPin, lastDistance, record, hardReset } = useAuth();
  const { ready, message: engineMessage, embedFromDataUrl } = useFaceEngine();
  const { pad, cameraSize, title, titleLine, body, bodyLine } = useLayout();
  const cameraRef = useRef<PhoneCameraHandle>(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [message, setMessage] = useState('Look at the camera, then scan.');
  const [busy, setBusy] = useState(false);
  const child = record?.childName ?? 'your child';

  useEffect(() => {
    if (!ready) setMessage(engineMessage);
  }, [engineMessage, ready]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    loadFaceModels().catch((error: unknown) => {
      const text = error instanceof Error ? error.message : 'Could not load the face model. Use your PIN.';
      debugLog('unlock', text, 'error');
      setMessage(text);
    });
  }, []);

  const scanFace = async () => {
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) throw new Error('Camera is not ready yet.');
      const result = await unlockWithFace(await embedFromDataUrl(photo.dataUrl));
      if (result === 'confirm') {
        setMessage('Close. Turn slightly and scan once more — this stops a sibling match.');
        return;
      }
      if (!result) setMessage('That is not the enrolled face. Try again, or use your PIN.');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not read that face.';
      debugLog('unlock', text, 'error', error instanceof Error ? error.stack : undefined);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  };

  const tryPin = async () => {
    setBusy(true);
    const ok = await unlockWithPin(pin);
    setBusy(false);
    if (!ok) setMessage('That PIN does not match.');
  };

  return (
    <Screen>
      <View style={[styles.page, { paddingHorizontal: pad }]}>
        <Logo />
        <Type variant="title" style={{ fontSize: title, lineHeight: titleLine }}>
          Welcome back
        </Type>
        <Type variant="body" style={{ fontSize: body, lineHeight: bodyLine }}>
          {`Only the enrolled parent can open ${child}’s Optix.`}
        </Type>

        <FaceWell hint={message} size={cameraSize}>
          <PhoneCamera ref={cameraRef} onError={setMessage} size={cameraSize} />
        </FaceWell>
        {lastDistance != null ? (
          <Type variant="caption">{`Match ${lastDistance.toFixed(2)} — under 0.40, then a second scan`}</Type>
        ) : null}

        <Button label={busy ? 'Scanning…' : 'Scan my face'} onPress={scanFace} disabled={busy || !ready} />
        <Button
          label={showPin ? 'Hide PIN' : 'Use PIN instead'}
          variant="quiet"
          onPress={() => setShowPin((value) => !value)}
        />

        {showPin ? (
          <View style={styles.pinBlock}>
            <TextInput
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="4-digit PIN"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Button label="Unlock with PIN" variant="ghost" onPress={tryPin} disabled={pin.length !== 4 || busy} />
          </View>
        ) : null}
              <Button
          label="Reset for Demo (Start from Scratch)"
          variant="ghost"
          onPress={() => {
            if (Platform.OS === 'web') {
              if (typeof window !== 'undefined' && window.confirm('Reset Optix and start demo onboarding from scratch?')) {
                hardReset();
              }
            } else {
              Alert.alert(
                'Demo Reset',
                'Reset all data and start onboarding from scratch?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset Everything', style: 'destructive', onPress: hardReset },
                ]
              );
            }
          }}
        />
</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,

    minWidth: 0,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  pinBlock: {
    gap: 12,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,

  },
});
