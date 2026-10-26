/** Author: BinaryBeast1209 */
import { type ReactNode } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { useLayout } from './useLayout';

const topPad = Platform.select({ ios: 50, android: (StatusBar.currentHeight ?? 18) + 8, default: 16 }) ?? 16;

export function Screen({ children }: { children: ReactNode }) {
  const { maxContentWidth, isTablet } = useLayout();

  return (
    <View style={styles.shell}>
      <View style={[styles.canvas, { maxWidth: maxContentWidth, borderRadius: isTablet ? 24 : 0 }]}>
        <View pointerEvents="none" style={styles.glowA} />
        <View pointerEvents="none" style={styles.glowB} />
        <View style={[styles.content, { paddingTop: topPad }]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.bg,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    paddingBottom: 10,
  },
  glowA: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(31, 107, 99, 0.1)',
    top: -120,
    right: -90,
  },
  glowB: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(201, 137, 74, 0.12)',
    bottom: 80,
    left: -100,
  },
});
