/** Author: BinaryBeast1209 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../theme';
import { SafeText } from './SafeText';

export type FrameStatus = 'ready' | 'reading' | 'good' | 'bad';

type Props = {
  children: ReactNode;
  hint?: string;
  size: number;
  height?: number;
  shape?: 'portrait' | 'eyes';
  status?: FrameStatus;
};

const BORDER = {
  ready: 'rgba(247, 241, 232, 0.88)',
  reading: '#E8C9A0',
  good: '#7DCEA0',
  bad: '#E7A598',
};

export function FaceWell({ children, hint, size, height, shape = 'portrait', status = 'ready' }: Props) {
  const frameHeight = height ?? size;
  const pulse = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== 'reading') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 480, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, status]);

  useEffect(() => {
    if (status !== 'good') {
      check.setValue(0);
      return;
    }
    check.setValue(0);
    Animated.spring(check, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, [check, status]);

  return (
    <View style={[styles.card, { width: size }]}>
      <View collapsable={false} style={[styles.stage, { width: size, height: frameHeight }]}>
        {children}
        <View pointerEvents="none" style={styles.overlay}>
          <Animated.View
            style={[
              styles.oval,
              shape === 'eyes' && styles.eyesOval,
              {
                borderColor: BORDER[status],
                borderWidth: status === 'good' ? 3 : 2,
                opacity: status === 'reading' ? pulse : 1,
              },
            ]}
          />
          {status === 'good' ? (
            <Animated.View style={[styles.check, { transform: [{ scale: check }] }]}>
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          ) : null}
        </View>
      </View>
      {hint ? (
        <View style={styles.hintBar}>
          <SafeText style={[styles.hint, status === 'good' && styles.hintGood, status === 'bad' && styles.hintBad]}>
            {hint}
          </SafeText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    borderRadius: radius.camera,
    overflow: 'hidden',
    backgroundColor: colors.cardInk,
    ...shadow.card,
  },
  stage: {
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oval: {
    width: '62%',
    height: '78%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(247, 241, 232, 0.88)',
  },
  eyesOval: {
    width: '78%',
    height: '42%',
  },
  hintBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardInk,
  },
  hint: {
    color: 'rgba(247, 241, 232, 0.78)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  hintGood: {
    color: '#C8EBD6',
  },
  hintBad: {
    color: '#F0C2B8',
  },
  check: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 54,
    height: 54,
    marginLeft: -27,
    marginTop: -27,
    borderRadius: 27,
    backgroundColor: 'rgba(61, 122, 86, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#F7F1E8',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
  },
});
