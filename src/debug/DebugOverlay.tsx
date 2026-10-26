/** Author: BinaryBeast1209 */
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFaceEngine } from '../auth/FaceEngine';
import { getDebugLog, subscribeDebug, type DebugEntry } from './log';

export function DebugOverlay() {
  const engine = useFaceEngine();
  const [open, setOpen] = useState(true);
  const [entries, setEntries] = useState<DebugEntry[]>(() => getDebugLog());
  const latestError = [...entries].reverse().find((entry) => entry.level === 'error');

  useEffect(() => {
    return subscribeDebug(() => {
      const next = getDebugLog();
      setEntries(next.slice());
      if (next[next.length - 1]?.level === 'error') setOpen(true);
    });
  }, []);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={styles.chip}>
        <Text style={styles.chipText}>
          {open ? 'Hide debug' : latestError ? `Debug · ${latestError.scope}: ${latestError.message}` : 'Debug'}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.panel}>
          <Text style={styles.status}>
            {engine.ready ? `Model ready. ${engine.message}` : `Model not ready. ${engine.message}`}
          </Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {entries.length === 0 ? (
              <Text style={styles.line}>No errors yet. Failures on this phone will show up here.</Text>
            ) : (
              [...entries].reverse().map((entry) => (
                <Text key={entry.id} selectable style={[styles.line, entry.level === 'error' && styles.bad]}>
                  {`${entry.scope}: ${entry.message}${entry.detail ? `\n${entry.detail}` : ''}`}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: Platform.OS === 'ios' ? 54 : 12,
    zIndex: 50,
    gap: 8,
    alignItems: 'flex-start',
  },
  chip: {
    backgroundColor: '#1C1915',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  chipText: {
    color: '#F7F1E8',
    fontSize: 12,
    fontWeight: '700',
  },
  panel: {
    alignSelf: 'stretch',
    maxHeight: 220,
    backgroundColor: 'rgba(28,25,21,0.94)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  status: {
    color: '#E8C9A0',
    fontSize: 12,
    lineHeight: 16,
  },
  scroll: {
    maxHeight: 160,
  },
  scrollContent: {
    gap: 8,
  },
  line: {
    color: '#F7F1E8',
    fontSize: 12,
    lineHeight: 16,
  },
  bad: {
    color: '#F0B2A6',
  },
});
