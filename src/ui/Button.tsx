/** Author: BinaryBeast1209 */
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { SafeText } from './SafeText';
import { colors, radius, textBase } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'quiet';
  style?: ViewStyle;
};

export function Button({ label, onPress, disabled, variant = 'primary', style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'ghost' && styles.ghost,
        variant === 'quiet' && styles.quiet,
        disabled && styles.disabled,
        style,
      ]}
    >
      <SafeText
        inline
        style={[
          styles.label,
          variant === 'primary' && styles.primaryLabel,
          variant !== 'primary' && styles.ghostLabel,
        ]}
      >
        {label}
      </SafeText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 52,
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  ghost: {
    backgroundColor: colors.accentSoft,
  },
  quiet: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...textBase,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryLabel: {
    color: '#F7F1E8',
  },
  ghostLabel: {
    color: colors.accentDeep,
  },
});
