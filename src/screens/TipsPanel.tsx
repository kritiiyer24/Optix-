/** Author: BinaryBeast1209 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AcuityConfirmedReport } from '../scan/acuityStore';
import type { ScanRecord } from '../scan/types';
import {
  evaluateTips,
  type TipCard,
  type TipCategory,
} from '../data/tipsEngine';
import {
  loadParentPrefs,
  saveParentPrefs,
  type ParentPrefs,
  DEFAULT_PREFS,
} from '../data/parentPrefsStore';
import {
  requestLocationAndFetchClinics,
  openDirections,
  callClinic,
  type EyeClinic,
} from '../services/nearbyClinics';
import { colors, radius, shadow, textBase } from '../theme';
import { SafeText } from '../ui/SafeText';
import { Type } from '../ui/Type';
import { useLayout } from '../ui/useLayout';

type FilterMode = 'all' | 'action' | 'habit' | 'access' | 'clinics';

type Props = {
  scans: ScanRecord[];
  acuityReport: AcuityConfirmedReport | null;
  childName?: string;
  onNavigateExam?: () => void;
};

export function TipsPanel({ scans, acuityReport, childName = 'your child', onNavigateExam }: Props) {
  const { narrow, compact, isTablet } = useLayout();
  const [prefs, setPrefs] = useState<ParentPrefs>(DEFAULT_PREFS);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Nearby Clinics state
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [locationAreaName, setLocationAreaName] = useState('');
  const [nearbyClinics, setNearbyClinics] = useState<EyeClinic[]>([]);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    loadParentPrefs().then(setPrefs);
  }, []);

  const handleUpdatePrefs = async (patch: Partial<ParentPrefs>) => {
    const updated = await saveParentPrefs(patch);
    setPrefs(updated);
  };

  const handleFetchClinics = async () => {
    try {
      setLocationStatus('loading');
      setLocationError('');
      const res = await requestLocationAndFetchClinics();
      setLocationAreaName(res.locationName);
      setNearbyClinics(res.clinics);
      setLocationStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not obtain location.';
      setLocationError(msg);
      setLocationStatus('error');
    }
  };

  const allTips = useMemo(() => {
    return evaluateTips({
      scans,
      acuityReport,
      prefs,
      childName,
    });
  }, [scans, acuityReport, prefs, childName]);

  const filteredTips = useMemo(() => {
    if (filter === 'all') return allTips;
    if (filter === 'habit') return allTips.filter((t) => t.category === 'habit' || t.category === 'comfort');
    if (filter === 'clinics') return [];
    return allTips.filter((t) => t.category === filter);
  }, [allTips, filter]);

  const badgeStyles = {
    danger: { bg: colors.danger, text: '#fff' },
    warning: { bg: colors.warning, text: '#fff' },
    success: { bg: colors.success, text: '#fff' },
    accent: { bg: colors.accent, text: '#fff' },
    neutral: { bg: colors.secondary, text: '#fff' },
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <Type variant="kicker">Personalized Clinical Guidance</Type>
        <SafeText style={styles.title}>Tips & Action Plan</SafeText>
        <SafeText style={styles.subtitle}>
          Guidance tailored to {childName}’s latest scan, reading test, and family history. Every habit card costs $0.
        </SafeText>
      </View>

      {/* Interactive Habit & Family Profile Bar (Full width, no clipping) */}
      <View style={styles.prefsCard}>
        <Type variant="kicker" style={styles.prefsKicker}>
          PERSONALIZE YOUR CHILD’S CONTEXT
        </Type>

        {/* 1. Family Myopia History */}
        <View style={styles.prefGroup}>
          <View style={styles.prefHeaderRow}>
            <SafeText style={styles.prefLabel}>Family Myopia</SafeText>
            <SafeText style={styles.prefHint}>
              {prefs.myopicParentsCount === 0
                ? 'Neither parent'
                : prefs.myopicParentsCount === 1
                ? '1 Parent (~3x risk)'
                : 'Both Parents (~7x risk)'}
            </SafeText>
          </View>
          <View style={styles.pillGroup}>
            {([0, 1, 2] as const).map((count) => {
              const active = prefs.myopicParentsCount === count;
              const label = count === 0 ? 'Neither' : count === 1 ? '1 Parent' : 'Both Parents';
              return (
                <Pressable
                  key={count}
                  onPress={() => handleUpdatePrefs({ myopicParentsCount: count })}
                  style={[styles.prefPill, active && styles.prefPillActive]}
                >
                  <SafeText inline style={[styles.prefPillText, active && styles.prefPillTextActive]}>
                    {label}
                  </SafeText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 2. Daily Outdoor Hours */}
        <View style={styles.prefGroup}>
          <View style={styles.prefHeaderRow}>
            <SafeText style={styles.prefLabel}>Outdoor Light</SafeText>
            <SafeText style={styles.prefHint}>
              {prefs.outdoorHoursPerDay >= 2 ? 'Target met (2+ hrs)' : 'Aim for ~2 hrs/day'}
            </SafeText>
          </View>
          <View style={styles.pillGroup}>
            {([0.5, 1, 2] as const).map((hrs) => {
              const active = prefs.outdoorHoursPerDay === hrs;
              const label = hrs === 2 ? '2+ hrs (Rec)' : `${hrs} hr`;
              return (
                <Pressable
                  key={hrs}
                  onPress={() => handleUpdatePrefs({ outdoorHoursPerDay: hrs })}
                  style={[styles.prefPill, active && styles.prefPillActive]}
                >
                  <SafeText inline style={[styles.prefPillText, active && styles.prefPillTextActive]}>
                    {label}
                  </SafeText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. Daily Screen Time */}
        <View style={styles.prefGroup}>
          <View style={styles.prefHeaderRow}>
            <SafeText style={styles.prefLabel}>Screen Time</SafeText>
            <SafeText style={styles.prefHint}>
              {prefs.dailyScreenHours <= 1 ? 'Healthy balance' : 'Take 20s breaks'}
            </SafeText>
          </View>
          <View style={styles.pillGroup}>
            {([1, 2, 3] as const).map((hrs) => {
              const active = prefs.dailyScreenHours === hrs;
              const label = hrs === 3 ? '3+ hrs' : `${hrs} hr${hrs > 1 ? 's' : ''}`;
              return (
                <Pressable
                  key={hrs}
                  onPress={() => handleUpdatePrefs({ dailyScreenHours: hrs })}
                  style={[styles.prefPill, active && styles.prefPillActive]}
                >
                  <SafeText inline style={[styles.prefPillText, active && styles.prefPillTextActive]}>
                    {label}
                  </SafeText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Category Filter Chips with Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {(
          [
            { id: 'all', label: `All Recommendations (${allTips.length})` },
            { id: 'clinics', label: '📍 Find Nearby Clinics' },
            { id: 'action', label: 'Doctor & Next Steps' },
            { id: 'habit', label: 'Free Daily Habits ($0)' },
            { id: 'access', label: 'Care & Free Glasses' },
          ] as const
        ).map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <SafeText inline style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </SafeText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* FEATURE: NEARBY EYE CLINICS & SERVICES CARD */}
      {filter === 'all' || filter === 'clinics' || filter === 'access' ? (
        <View style={styles.clinicSectionCard}>
          <View style={styles.whyBanner}>
            <SafeText style={styles.whyText}>
              💡 <SafeText inline style={{ fontWeight: '700' }}>Why you’re seeing this:</SafeText> To help your family quickly find top-rated pediatric eye clinics, community health centers, and optical providers near you.
            </SafeText>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <SafeText inline style={[styles.badgeText, { color: '#fff' }]}>
                Local Healthcare Access
              </SafeText>
            </View>
            <View style={styles.freeBadge}>
              <SafeText inline style={styles.freeBadgeText}>
                Top 4–5 Rated Providers
              </SafeText>
            </View>
          </View>

          <SafeText style={styles.cardTitle}>Find Top-Rated Eye Clinics Near You</SafeText>
          <SafeText style={styles.cardBody}>
            Would you like to view nearby licensed pediatric optometrists, ophthalmologists, and Medicaid-accepting vision centers? Enable location to see real-time clinic distances and phone numbers.
          </SafeText>

          {locationStatus === 'idle' ? (
            <Pressable onPress={handleFetchClinics} style={styles.actionButton}>
              <SafeText inline style={styles.actionButtonText}>
                📍 Find Top-Rated Clinics Near Me
              </SafeText>
            </Pressable>
          ) : null}

          {locationStatus === 'loading' ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.accent} />
              <SafeText style={styles.loadingText}>Locating verified pediatric eye clinics near you...</SafeText>
            </View>
          ) : null}

          {locationStatus === 'error' ? (
            <View style={styles.errorBox}>
              <SafeText style={styles.errorText}>{locationError}</SafeText>
              <Pressable onPress={handleFetchClinics} style={[styles.actionButton, { marginTop: 8 }]}>
                <SafeText inline style={styles.actionButtonText}>
                  Retry With Location
                </SafeText>
              </Pressable>
            </View>
          ) : null}

          {locationStatus === 'success' ? (
            <View style={styles.clinicsList}>
              <View style={styles.clinicsHeaderRow}>
                <SafeText style={styles.clinicsListTitle}>
                  Top-Rated Clinics Near {locationAreaName}
                </SafeText>
                <Pressable onPress={handleFetchClinics}>
                  <SafeText style={styles.refreshText}>🔄 Refresh</SafeText>
                </Pressable>
              </View>

              {nearbyClinics.map((clinic, index) => (
                <View key={clinic.id} style={styles.clinicCard}>
                  <View style={styles.clinicCardHeader}>
                    <View style={styles.clinicIndexBadge}>
                      <SafeText inline style={styles.clinicIndexText}>
                        #{index + 1}
                      </SafeText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <SafeText style={styles.clinicName}>{clinic.name}</SafeText>
                      <SafeText style={styles.clinicSpecialty}>{clinic.specialty}</SafeText>
                    </View>
                  </View>

                  <View style={styles.clinicDetailsRow}>
                    <SafeText style={styles.clinicRating}>
                      ⭐ {clinic.rating} ({clinic.reviewCount} reviews)
                    </SafeText>
                    <SafeText style={styles.clinicDistance}>
                      📍 {clinic.distanceMiles} miles away
                    </SafeText>
                  </View>

                  <View style={styles.clinicTagsRow}>
                    {clinic.acceptsMedicaid ? (
                      <View style={styles.medicaidBadge}>
                        <SafeText inline style={styles.medicaidBadgeText}>
                          ✓ Medicaid / CHIP (Low / $0)
                        </SafeText>
                      </View>
                    ) : null}
                    {clinic.pediatricCertified ? (
                      <View style={styles.pediatricBadge}>
                        <SafeText inline style={styles.pediatricBadgeText}>
                          ✓ Pediatric Specialists
                        </SafeText>
                      </View>
                    ) : null}
                  </View>

                  <SafeText style={styles.clinicAddress}>{clinic.address}</SafeText>

                  <View style={styles.clinicButtonsRow}>
                    <Pressable
                      onPress={() => callClinic(clinic.phone)}
                      style={[styles.clinicBtn, styles.callBtn]}
                    >
                      <SafeText inline style={styles.callBtnText}>
                        📞 {clinic.phone}
                      </SafeText>
                    </Pressable>
                    <Pressable
                      onPress={() => openDirections(clinic)}
                      style={[styles.clinicBtn, styles.mapBtn]}
                    >
                      <SafeText inline style={styles.mapBtnText}>
                        🗺️ Directions
                      </SafeText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Personalized Dynamic Card Feed */}
      <View style={styles.cardsList}>
        {filteredTips.map((card) => {
          const badge = badgeStyles[card.badgeTone];

          return (
            <View key={card.id} style={styles.card}>
              {/* "Why You're Seeing This" Kicker Pill */}
              <View style={styles.whyBanner}>
                <SafeText style={styles.whyText}>
                  💡 <SafeText inline style={{ fontWeight: '700' }}>Why you’re seeing this:</SafeText>{' '}
                  {card.whyYouSeeThis.replace(/^Why you're seeing this:\s*/i, '')}
                </SafeText>
              </View>

              {/* Card Meta & Badges */}
              <View style={styles.metaRow}>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <SafeText inline style={[styles.badgeText, { color: badge.text }]}>
                    {card.categoryLabel}
                  </SafeText>
                </View>

                {card.isFreeHabit ? (
                  <View style={styles.freeBadge}>
                    <SafeText inline style={styles.freeBadgeText}>
                      $0 Free Habit
                    </SafeText>
                  </View>
                ) : null}
              </View>

              {/* Title & Body */}
              <SafeText style={styles.cardTitle}>{card.title}</SafeText>
              <SafeText style={styles.cardBody}>{card.body}</SafeText>

              {/* Key Details Checklist */}
              {card.keyDetails && card.keyDetails.length > 0 ? (
                <View style={styles.detailsBox}>
                  {card.keyDetails.map((detail, idx) => (
                    <View key={idx} style={styles.detailRow}>
                      <SafeText inline style={styles.detailBullet}>
                        •
                      </SafeText>
                      <SafeText style={styles.detailText}>{detail}</SafeText>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Card Action if Applicable */}
              {card.id === 'referral_doctor' && onNavigateExam ? (
                <Pressable onPress={onNavigateExam} style={styles.cardButton}>
                  <SafeText inline style={styles.cardButtonText}>
                    Review Verified Vision Report
                  </SafeText>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    paddingBottom: 48,
    gap: 16,
  },
  header: {
    gap: 4,
    marginBottom: 4,
  },
  title: {
    ...textBase,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    ...textBase,
    fontSize: 14,
    lineHeight: 20,
    color: colors.secondary,
  },
  prefsCard: {
    backgroundColor: '#FAF6EF',
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
    gap: 14,
    ...shadow.card,
  },
  prefsKicker: {
    color: colors.accentDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  prefGroup: {
    gap: 6,
  },
  prefHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  prefLabel: {
    ...textBase,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  prefHint: {
    ...textBase,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    flexShrink: 0,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  prefPill: {
    flex: 1,
    backgroundColor: '#FFFBF6',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  prefPillText: {
    ...textBase,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
    textAlign: 'center',
  },
  prefPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    backgroundColor: '#FFFBF6',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  filterChipActive: {
    backgroundColor: colors.cardInk,
    borderColor: colors.cardInk,
  },
  filterText: {
    ...textBase,
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  cardsList: {
    gap: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 18,
    gap: 12,
    ...shadow.card,
  },
  clinicSectionCard: {
    backgroundColor: '#F5FAF8',
    borderColor: 'rgba(31, 107, 99, 0.35)',
    borderWidth: 1.5,
    borderRadius: radius.card,
    padding: 18,
    gap: 14,
    ...shadow.card,
  },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionButtonText: {
    ...textBase,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: 'rgba(31, 107, 99, 0.06)',
    borderRadius: 14,
  },
  loadingText: {
    ...textBase,
    fontSize: 13,
    color: colors.accentDeep,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(154, 74, 60, 0.08)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    ...textBase,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  clinicsList: {
    gap: 12,
    marginTop: 4,
  },
  clinicsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clinicsListTitle: {
    ...textBase,
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  refreshText: {
    ...textBase,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  clinicCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    ...shadow.card,
  },
  clinicCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  clinicIndexBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  clinicIndexText: {
    ...textBase,
    fontSize: 12,
    fontWeight: '800',
    color: colors.accentDeep,
  },
  clinicName: {
    ...textBase,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  clinicSpecialty: {
    ...textBase,
    fontSize: 12,
    color: colors.secondary,
    marginTop: 2,
  },
  clinicDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  clinicRating: {
    ...textBase,
    fontSize: 13,
    fontWeight: '700',
    color: '#B86A2D',
    flexShrink: 1,
  },
  clinicDistance: {
    ...textBase,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    flexShrink: 0,
  },
  clinicTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  medicaidBadge: {
    backgroundColor: 'rgba(60, 122, 86, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  medicaidBadgeText: {
    ...textBase,
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  pediatricBadge: {
    backgroundColor: 'rgba(31, 107, 99, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pediatricBadgeText: {
    ...textBase,
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  clinicAddress: {
    ...textBase,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
  },
  clinicButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  clinicBtn: {
    flex: 1,
    borderRadius: radius.button,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtn: {
    backgroundColor: '#FAF7F2',
    borderColor: colors.line,
    borderWidth: 1,
  },
  callBtnText: {
    ...textBase,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  mapBtn: {
    backgroundColor: colors.accent,
  },
  mapBtnText: {
    ...textBase,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  whyBanner: {
    backgroundColor: 'rgba(31, 107, 99, 0.08)',
    borderColor: 'rgba(31, 107, 99, 0.25)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  whyText: {
    ...textBase,
    fontSize: 12,
    lineHeight: 16,
    color: colors.accentDeep,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    ...textBase,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  freeBadge: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  freeBadgeText: {
    ...textBase,
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  cardTitle: {
    ...textBase,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 24,
  },
  cardBody: {
    ...textBase,
    fontSize: 14,
    lineHeight: 21,
    color: colors.secondary,
  },
  detailsBox: {
    backgroundColor: 'rgba(28, 25, 21, 0.03)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  detailBullet: {
    ...textBase,
    fontSize: 14,
    color: colors.accent,
    fontWeight: '700',
    lineHeight: 18,
  },
  detailText: {
    ...textBase,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  cardButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cardButtonText: {
    ...textBase,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
