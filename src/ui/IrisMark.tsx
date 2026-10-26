/** Author: BinaryBeast1209 */
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  size?: number;
};

export function IrisMark({ size = 120 }: Props) {
  const mid = size * 0.68;
  const pupil = size * 0.3;
  const glint = Math.max(8, size * 0.1);
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.goldSoft,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: mid,
            height: mid,
            borderRadius: mid / 2,
            backgroundColor: colors.accent,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: mid * 0.72,
            height: mid * 0.72,
            borderRadius: (mid * 0.72) / 2,
            backgroundColor: colors.accentDeep,
          },
        ]}
      />
      <View
        style={{
          width: pupil,
          height: pupil,
          borderRadius: pupil / 2,
          backgroundColor: colors.cardInk,
        }}
      />
      <View
        style={[
          styles.glint,
          {
            width: glint,
            height: glint,
            borderRadius: glint / 2,
            top: size * 0.3,
            left: size * 0.42,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  glint: {
    position: 'absolute',
    backgroundColor: '#F7F1E8',
  },
});
