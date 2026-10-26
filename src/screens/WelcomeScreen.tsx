/** Author: BinaryBeast1209 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { brand, colors } from '../theme';
import { Button } from '../ui/Button';
import { IrisMark } from '../ui/IrisMark';
import { Logo } from '../ui/Logo';
import { SafeText } from '../ui/SafeText';
import { Screen } from '../ui/Screen';
import { Type } from '../ui/Type';
import { useLayout } from '../ui/useLayout';

const PAGES = [
  {
    kicker: 'For growing eyes',
    title: 'Advice that follows their eyes.',
    body: 'Not a one-size reminder. Optix watches this child’s trend, then changes the plan.',
  },
  {
    kicker: 'One flash photo',
    title: 'Five readings. One still.',
    body: 'Near, far, astigmatism, left versus right, and alignment. Never a diagnosis — a reason to see a doctor.',
  },
  {
    kicker: 'On this device',
    title: 'Your phone keeps the photos.',
    body: 'You unlock with your face. Scans never leave the device. Built for a parent, not a clinic.',
  },
];

export function WelcomeScreen() {
  const { finishWelcome } = useAuth();
  const { pad, display, displayLine, body, bodyLine, iris } = useLayout();
  const [page, setPage] = useState(0);
  const current = PAGES[page];
  const last = page === PAGES.length - 1;

  return (
    <Screen>
      <View style={[styles.page, { paddingHorizontal: pad }]}>
        <Logo />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.hero}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.portrait}>
            <IrisMark size={iris} />
          </View>
          <Type variant="kicker">{current.kicker}</Type>
          <Type variant="display" style={{ fontSize: display, lineHeight: displayLine }}>
            {current.title}
          </Type>
          <Type variant="body" style={{ fontSize: body, lineHeight: bodyLine }}>
            {current.body}
          </Type>
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.dots}>
            {PAGES.map((item, index) => (
              <View key={item.kicker} style={[styles.dot, index === page && styles.dotOn]} />
            ))}
          </View>
          <Button
            label={last ? 'Create parent unlock' : 'Continue'}
            onPress={() => {
              if (last) {
                finishWelcome();
                return;
              }
              setPage((value) => value + 1);
            }}
          />
          {!last ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={finishWelcome}>
              <SafeText style={styles.skip}>Skip intro</SafeText>
            </Pressable>
          ) : (
            <SafeText style={styles.foot}>{brand.tagline}</SafeText>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    paddingTop: 8,
    paddingBottom: 4,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    marginTop: 16,
  },
  hero: {
    gap: 12,
    paddingBottom: 16,
    paddingRight: 2,
  },
  portrait: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginBottom: 6,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  footer: {
    gap: 10,
    paddingTop: 12,
    backgroundColor: colors.bg,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  dotOn: {
    width: 22,
    backgroundColor: colors.accent,
  },
  skip: {
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '600',
    paddingVertical: 8,
    fontSize: 15,
    lineHeight: 20,
  },
  foot: {
    textAlign: 'center',
    color: colors.muted,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 20,
  },
});
