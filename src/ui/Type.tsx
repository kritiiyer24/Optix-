/** Author: BinaryBeast1209 */
import { StyleSheet, type TextStyle } from 'react-native';
import { colors, displayBase, textBase } from '../theme';
import { SafeText } from './SafeText';

type Variant = 'display' | 'title' | 'body' | 'kicker' | 'caption' | 'label';

type Props = {
  variant: Variant;
  children: string;
  style?: TextStyle | TextStyle[];
};

export function Type({ variant, children, style }: Props) {
  return <SafeText style={[styles[variant], style]}>{children}</SafeText>;
}

const styles = StyleSheet.create({
  display: {
    ...displayBase,
    color: colors.text,
  },
  title: {
    ...displayBase,
    color: colors.text,
  },
  body: {
    ...textBase,
    color: colors.secondary,
  },
  kicker: {
    ...textBase,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  caption: {
    ...textBase,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    ...textBase,
    color: colors.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
