/** Author: BinaryBeast1209 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthContext';
import { debugLog } from '../debug/log';
import { useFaceEngine } from '../auth/FaceEngine';
import { loadFaceModels } from '../auth/face';
import { uriToDataUrl } from '../auth/imageData';
import type { FaceVector } from '../auth/types';
import { PhoneCamera, type PhoneCameraHandle } from '../components/PhoneCamera';
import { colors, radius, textBase } from '../theme';
import { Button } from '../ui/Button';
import { FaceWell } from '../ui/FaceWell';
import { Logo } from '../ui/Logo';
import { SafeText } from '../ui/SafeText';
import { Screen } from '../ui/Screen';
import { Type } from '../ui/Type';
import { useLayout } from '../ui/useLayout';

const SLOTS = 3;

export function EnrollScreen() {
  const { enroll } = useAuth();
  const { ready, message: engineMessage, embedFromDataUrl } = useFaceEngine();
  const { pad, cameraSize, title, titleLine, body, bodyLine } = useLayout();
  const cameraRef = useRef<PhoneCameraHandle>(null);
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [pin, setPin] = useState('');
  const [samples, setSamples] = useState<FaceVector[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(engineMessage);

  useEffect(() => {
    setMessage(engineMessage);
  }, [engineMessage]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    loadFaceModels()
      .then(() => setMessage('Ready. Use the parent face — never the child.'))
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : 'Could not load the face model.';
        debugLog('enroll', text, 'error');
        setMessage(text);
      });
  }, []);

  const addSample = async (vector: FaceVector) => {
    setSamples((current) => (current.length >= SLOTS ? current : [...current, vector]));
    setMessage('Saved. Turn slightly for the next frame.');
  };

  const capture = async () => {
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) throw new Error('Camera is not ready yet.');
      await addSample(await embedFromDataUrl(photo.dataUrl));
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not read that photo.';
      debugLog('enroll', text, 'error', error instanceof Error ? error.stack : undefined);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  };

  const pickFromFiles = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setBusy(true);
    try {
      await addSample(await embedFromDataUrl(await uriToDataUrl(result.assets[0].uri)));
    } catch (error) {
      const text = error instanceof Error ? error.message : 'That file did not show a clear face.';
      debugLog('enroll', text, 'error', error instanceof Error ? error.stack : undefined);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await enroll(pin, samples, childName, Number(childAge));
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not finish enrollment.';
      debugLog('enroll', text, 'error', error instanceof Error ? error.stack : undefined);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(text);
      } else {
        Alert.alert('Enrollment', text);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        style={[styles.scroll, { paddingHorizontal: pad }]}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        <Logo />
        <Type variant="kicker">{`Step ${Math.min(samples.length + 1, SLOTS)} of ${SLOTS}`}</Type>
        <Type variant="title" style={{ fontSize: title, lineHeight: titleLine }}>
          Your face, not theirs.
        </Type>
        <Type variant="body" style={{ fontSize: body, lineHeight: bodyLine }}>
          Three stills unlock Optix. They stay on this phone and are never used for the eye scan.
        </Type>

        <FaceWell hint="Hold the phone at arm’s length. Parent only." size={cameraSize}>
          <PhoneCamera ref={cameraRef} onError={setMessage} size={cameraSize} />
        </FaceWell>

        <View style={styles.dots}>
          {Array.from({ length: SLOTS }).map((_, index) => (
            <View key={index} style={[styles.dot, index < samples.length && styles.dotOn]} />
          ))}
          <SafeText inline style={styles.dotLabel}>
            {`${samples.length} of ${SLOTS} saved`}
          </SafeText>
        </View>
        <Type variant="caption">{message}</Type>

        <Button
          label={busy ? 'Reading face…' : 'Capture this frame'}
          onPress={capture}
          disabled={busy || !ready}
        />
        <Button label="Use a photo I already have" variant="ghost" onPress={pickFromFiles} disabled={busy || !ready} />

        <View style={styles.sheet}>
          <Type variant="label">Child’s first name</Type>
          <TextInput
            value={childName}
            onChangeText={setChildName}
            placeholder="For the home screen"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Type variant="label">Child’s age in years</Type>
          <TextInput
            value={childAge}
            onChangeText={(value) => setChildAge(value.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="4 or older uses a lower far-vision line"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Type variant="label">Backup PIN</Type>
          <TextInput
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            placeholder="4 digits"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.pin]}
          />
        </View>

        <Button
          label="Save and enter Optix"
          onPress={finish}
          disabled={samples.length < SLOTS || pin.length !== 4 || childAge.length === 0 || busy}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,

  },
  page: {


    alignItems: 'stretch',
    paddingTop: 8,
    paddingBottom: 36,
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.line,
  },
  dotOn: {
    backgroundColor: colors.accent,
  },
  dotLabel: {
    ...textBase,
    color: colors.secondary,
    fontSize: 13,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,

  },
  pin: {
    fontSize: 20,
    letterSpacing: 8,
  },
});
