/** Author: BinaryBeast1209 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { CONDITIONS } from '../data/demoHome';
import { toneFor } from '../scan/measure';
import { loadScans } from '../scan/store';
import type { ReadingKey, ScanRecord } from '../scan/types';
import { brand, colors, displayBase, radius, shadow, textBase } from '../theme';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { SafeText } from '../ui/SafeText';
import { Screen } from '../ui/Screen';
import { Type } from '../ui/Type';
import { useLayout } from '../ui/useLayout';

import { EyeTestPanel } from './EyeTestPanel';
import { TipsPanel } from './TipsPanel';
import { loadLatestAcuity, type AcuityConfirmedReport } from '../scan/acuityStore';

type Tab = 'home' | 'exam' | 'tips' | 'you';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const READING_FOR: Record<string, ReadingKey> = {
  myopia: 'near',
  hyperopia: 'far',
  astigmatism: 'astigmatism',
  aniso: 'aniso',
  align: 'alignment',
};

function todayLabel(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

export function HomeScreen() {
  const { lock, resetWithPin, hardReset, record } = useAuth();
  const { pad, title, titleLine, body, bodyLine, compact, narrow, isTablet } = useLayout();
  const [tab, setTab] = useState<Tab>('home');
  const [pin, setPin] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [acuityReport, setAcuityReport] = useState<AcuityConfirmedReport | null>(null);
  const child = record?.childName ?? 'your child';

  useEffect(() => {
    loadScans().then(setScans).catch(() => setScans([]));
    loadLatestAcuity().then(setAcuityReport).catch(() => setAcuityReport(null));
  }, [tab]);

  const toneColor = {
    idle: colors.gold,
    watch: colors.warning,
    ok: colors.success,
  };

  const tabs = useMemo(
    () =>
      [
        { id: 'home' as const, label: 'Home' },
        { id: 'exam' as const, label: 'Eye Test' },
        { id: 'tips' as const, label: 'Tips' },
        { id: 'you' as const, label: 'You' },
      ],
    [],
  );

  return (
    <Screen>
      <View style={[styles.shell, { paddingHorizontal: pad }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'home' ? (
            <>
              <View style={styles.top}>
                <Logo />
                <Pressable accessibilityRole="button" onPress={lock} style={styles.lockChip}>
                  <SafeText inline style={styles.lockChipText}>
                    Lock
                  </SafeText>
                </Pressable>
              </View>
              <Type variant="kicker">{todayLabel()}</Type>
              <Type variant="caption">{greeting()}</Type>
              <Type variant="title" style={{ fontSize: title, lineHeight: titleLine }}>
                {`${child}’s eyes`}
              </Type>
              <Type variant="body" style={{ fontSize: body, lineHeight: bodyLine }}>
                {scans.length === 0
                  ? 'No scan yet. The first flash photo starts their trend — not a diagnosis.'
                  : `${scans.length} flash ${scans.length === 1 ? 'photo' : 'photos'} on this phone. A signal to watch, not a diagnosis.`}
              </Type>

              <View style={styles.hero}>
                <Type variant="kicker" style={styles.heroKicker}>
                  Ready when you are
                </Type>
                <SafeText style={[styles.heroTitle, { fontSize: narrow ? 20 : compact ? 22 : 24, lineHeight: narrow ? 26 : compact ? 28 : 30 }]}>One photo. Five readings. A plan that can change.</SafeText>
                <SafeText style={[styles.heroBody, { fontSize: narrow ? 13 : 15, lineHeight: narrow ? 19 : 22 }]}>
                  Near, far, astigmatism, left versus right, and alignment from the same red-reflex test.
                </SafeText>
                <Button label="Start Complete Eye Test" onPress={() => setTab('exam')} />
                {scans.length > 0 && scans[scans.length - 1].analysis ? (
                  <Button
                    label="👁️ View Photorefraction Scan Analysis"
                    variant="ghost"
                    onPress={() => setTab('exam')}
                  />
                ) : null}
              </View>

              {/* Doctor's Eye Reading Test Card */}
              <View style={[styles.hero, { marginTop: 4, backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: colors.line }]}>
                <Type variant="kicker" style={{ color: colors.accentDeep }}>
                  Clinical Confirmation
                </Type>
                <SafeText style={[styles.heroTitle, { color: colors.text, fontSize: narrow ? 20 : compact ? 22 : 24, lineHeight: narrow ? 26 : compact ? 28 : 30 }]}>
                  {acuityReport
                    ? `Visual Acuity: ${acuityReport.rightAcuity} / ${acuityReport.leftAcuity}`
                    : 'Doctor’s Eye Reading Test'}
                </SafeText>
                <SafeText style={[styles.heroBody, { color: colors.secondary, fontSize: narrow ? 13 : 15, lineHeight: narrow ? 19 : 22 }]}>
                  {acuityReport
                    ? `${acuityReport.overallStatus}. Cross-verified with scan reflection data.`
                    : 'Check distance reading acuity with our calibrated Tumbling E chart to clinically confirm scan results.'}
                </SafeText>
                <Button
                  label={acuityReport ? 'View Confirmed Vision Report' : 'Take Doctor’s Eye Test'}
                  variant="ghost"
                  onPress={() => setTab('exam')}
                />
              </View>

              <Type variant="label">Conditions</Type>
              <View style={styles.ledger}>
                {CONDITIONS.map((item, index) => {
                  const tone = toneFor(READING_FOR[item.id], scans);
                  const label = tone === 'watch' ? 'Watch' : tone === 'ok' ? 'Steady' : 'Waiting';
                  return (
                    <View
                      key={item.id}
                      style={[styles.ledgerRow, index > 0 && styles.ledgerRule]}
                    >
                      <View style={[styles.dot, { backgroundColor: toneColor[tone] }]} />
                      <View style={styles.rowCopy}>
                        <SafeText style={styles.conditionTitle}>{item.title}</SafeText>
                        <SafeText style={styles.conditionHint}>{item.hint}</SafeText>
                      </View>
                      <SafeText inline style={styles.conditionState}>
                        {label}
                      </SafeText>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {tab === 'exam' ? (
            <>
              <Logo />
              <EyeTestPanel scans={scans} onSavedScans={setScans} onDone={() => setTab('home')} />
            </>
          ) : null}

          {tab === 'tips' ? (
            <>
              <Logo />
              <TipsPanel
                scans={scans}
                acuityReport={acuityReport}
                childName={child}
                onNavigateExam={() => setTab('exam')}
              />
            </>
          ) : null}

          {tab === 'you' ? (
            <>
              <Logo />
              <Type variant="title" style={{ fontSize: title, lineHeight: titleLine }}>
                Parent space
              </Type>
              <Type variant="body" style={{ fontSize: body, lineHeight: bodyLine }}>
                {`${brand.name} is a screening companion, not a clinic. Photos stay on this device.`}
              </Type>
              <View style={styles.panel}>
                <Type variant="title" style={styles.panelTitle}>
                  Safety
                </Type>
                <Type variant="body" style={styles.panelBody}>
                  Optix will never say a child has myopia. It can only suggest that a follow-up exam may be worth scheduling.
                </Type>
              </View>
              <Button label="Lock Optix" onPress={lock} />
              <Type variant="label">Reset this phone</Type>
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
              <Button
                label="Clear face and start over"
                variant="ghost"
                onPress={async () => {
                  const ok = await resetWithPin(pin);
                  setResetMessage(ok ? '' : 'PIN did not match.');
                }}
                disabled={pin.length !== 4}
              />
                            {resetMessage ? <Type variant="caption" style={styles.error}>{resetMessage}</Type> : null}

              <View style={{ height: 16 }} />
              <Type variant="label">Demo Recording</Type>
              <Button
                label="Reset App for Demo (Start from Scratch)"
                variant="ghost"
                onPress={() => {
                  if (Platform.OS === 'web') {
                    if (typeof window !== 'undefined' && window.confirm('Reset Optix and start onboarding demo from scratch?')) {
                      hardReset();
                    }
                  } else {
                    Alert.alert(
                      'Demo Reset',
                      'Clear all data and return to the Welcome onboarding screen?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reset to Welcome', style: 'destructive', onPress: hardReset },
                      ]
                    );
                  }
                }}
              />
            </>
          ) : null}
        </ScrollView>

        <View style={styles.tabBar}>
          {tabs.map((item) => {
            const on = tab === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => setTab(item.id)}
                style={[styles.tab, on && styles.tabActive, { paddingVertical: narrow ? 8 : compact ? 9 : 11 }]}
              >
                <SafeText
                  inline
                  numberOfLines={1}
                  style={[styles.tabLabel, on && styles.tabOn, { fontSize: narrow ? 11 : compact ? 12 : 13 }]}
                >
                  {item.label}
                </SafeText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    minWidth: 0,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  page: {


    alignItems: 'stretch',
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  lockChip: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  lockChipText: {
    ...textBase,
    color: colors.accentDeep,
    fontWeight: '600',
  },
  hero: {
    backgroundColor: colors.cardInk,
    borderRadius: radius.card,
    padding: 20,
    gap: 10,
    ...shadow.card,
  },
  heroKicker: {
    color: '#E8C9A0',
  },
  heroTitle: {
    ...displayBase,
    color: '#F7F1E8',
    fontSize: 24,
    lineHeight: 30,
  },
  heroBody: {
    ...textBase,
    color: 'rgba(247,241,232,0.78)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  ledger: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  ledgerRule: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  conditionTitle: {
    ...textBase,
    fontWeight: '700',
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
  conditionHint: {
    ...textBase,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  conditionState: {
    ...textBase,
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  panelBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  tip: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tipBody: {
    fontSize: 15,
    lineHeight: 22,
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
  error: {
    color: colors.danger,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 16,
  },
  tabActive: {
    backgroundColor: colors.accentSoft,
  },
  tabLabel: {
    ...textBase,
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
  },
  tabOn: {
    color: colors.accentDeep,
  },
});
