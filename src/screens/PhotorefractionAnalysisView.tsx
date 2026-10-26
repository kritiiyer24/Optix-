/** Author: BinaryBeast1209 */
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { PhotorefractionAnalysis } from '../scan/types';
import { colors, radius, shadow, textBase } from '../theme';
import { SafeText } from '../ui/SafeText';
import { Type } from '../ui/Type';
import { useLayout } from '../ui/useLayout';

type Props = {
  analysis: PhotorefractionAnalysis;
  onProceed: () => void;
  onRetake?: () => void;
};

export function PhotorefractionAnalysisView({ analysis, onProceed, onRetake }: Props) {
  const { narrow, compact, isTablet } = useLayout();
  const { leftEye, rightEye, setupRows } = analysis;

  return (
    <View style={styles.container}>
      {/* Top Banner & Title */}
      <View style={styles.header}>
        <Type variant="kicker">Objective Optical Analysis</Type>
        <SafeText style={[styles.title, narrow && { fontSize: 22 }]}>Photorefraction Screening</SafeText>
        <SafeText style={styles.subtitle}>
          Analysis of ocular red reflex crescents, corneal Hirschberg alignment, and refractive estimates.
        </SafeText>
      </View>

      {/* 1. Annotated Portrait Image */}
      <View style={styles.shotCard}>
        {analysis.annotatedImageUrl ? (
          <Image
            source={{ uri: analysis.annotatedImageUrl }}
            style={styles.portraitImage}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.captionBox}>
          <SafeText style={styles.captionText}>
            Green circles mark the iris found in each eye. Orange boxes mark the red reflex that was measured.
          </SafeText>
        </View>
      </View>

      {/* 2. Image - Left Eye */}
      <View style={styles.eyeCard}>
        <View style={styles.eyeHead}>
          {leftEye.cropUrl ? (
            <Image source={{ uri: leftEye.cropUrl }} style={styles.eyeCrop} />
          ) : (
            <View style={[styles.eyeCrop, styles.placeholderCrop]}>
              <SafeText style={styles.eyeCropText}>OS</SafeText>
            </View>
          )}
          <View>
            <SafeText style={styles.eyeName}>Image-left eye</SafeText>
            <SafeText style={styles.eyeSubtitle}>Left Eye (OS)</SafeText>
          </View>
        </View>

        <View style={styles.tableList}>
          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Horizontal</SafeText>
            <SafeText style={styles.tableValue}>{leftEye.horizontal}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Vertical</SafeText>
            <SafeText style={styles.tableValue}>{leftEye.vertical}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Astigmatism</SafeText>
            <SafeText style={styles.tableValue}>{leftEye.astigmatism}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Alignment</SafeText>
            <SafeText style={styles.tableValue}>{leftEye.alignment}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Dead zone</SafeText>
            <SafeText style={styles.tableValue}>{leftEye.deadZone}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Reflex strength</SafeText>
            <SafeText style={styles.tableValue}>{leftEye.reflexStrength}</SafeText>
          </View>
        </View>
      </View>

      {/* 3. Image - Right Eye */}
      <View style={styles.eyeCard}>
        <View style={styles.eyeHead}>
          {rightEye.cropUrl ? (
            <Image source={{ uri: rightEye.cropUrl }} style={styles.eyeCrop} />
          ) : (
            <View style={[styles.eyeCrop, styles.placeholderCrop]}>
              <SafeText style={styles.eyeCropText}>OS</SafeText>
            </View>
          )}
          <View>
            <SafeText style={styles.eyeName}>Image-right eye</SafeText>
            <SafeText style={styles.eyeSubtitle}>Left Eye (OS)</SafeText>
          </View>
        </View>

        <View style={styles.tableList}>
          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Horizontal</SafeText>
            <SafeText style={styles.tableValue}>{rightEye.horizontal}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Vertical</SafeText>
            <SafeText style={styles.tableValue}>{rightEye.vertical}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Astigmatism</SafeText>
            <SafeText style={styles.tableValue}>{rightEye.astigmatism}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Alignment</SafeText>
            <SafeText style={styles.tableValue}>{rightEye.alignment}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Dead zone</SafeText>
            <SafeText style={styles.tableValue}>{rightEye.deadZone}</SafeText>
          </View>
          <View style={styles.tableDivider} />

          <View style={styles.tableRow}>
            <SafeText style={styles.tableLabel}>Reflex strength</SafeText>
            <SafeText style={styles.tableValue}>{rightEye.reflexStrength}</SafeText>
          </View>
        </View>
      </View>

      {/* 4. Left vs Right (Anisometropia Comparison) */}
      <View style={styles.infoCard}>
        <View style={styles.tableRow}>
          <SafeText style={styles.tableLabel}>Left vs right</SafeText>
          <SafeText style={styles.tableValue}>{analysis.anisoComparison}</SafeText>
        </View>
      </View>

      {/* Distance Alert (if needed) */}
      {analysis.cameraDistanceNote ? (
        <View style={styles.alertCard}>
          <SafeText style={styles.alertText}>{analysis.cameraDistanceNote}</SafeText>
        </View>
      ) : null}

      {/* 5. Camera Distance & Calibration Setup */}
      {setupRows && setupRows.length > 0 ? (
        <View style={styles.infoCard}>
          <View style={styles.tableList}>
            {setupRows.map(([label, value], idx) => (
              <View key={label}>
                {idx > 0 ? <View style={styles.tableDivider} /> : null}
                <View style={styles.tableRow}>
                  <SafeText style={styles.tableLabel}>{label}</SafeText>
                  <SafeText style={styles.tableValue}>{value}</SafeText>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Calibration Footer Note */}
      <SafeText style={styles.footerNote}>{analysis.calibrationFooter}</SafeText>

      {/* PRIMARY ACTION BUTTON: Confirm with Doctor's Reading Test */}
      <View style={styles.bottomBar}>
        <Pressable onPress={onProceed} style={styles.proceedButton}>
          <SafeText inline style={styles.proceedButtonText}>
            Confirm with Doctor’s Reading Test →
          </SafeText>
        </Pressable>

        {onRetake ? (
          <Pressable onPress={onRetake} style={styles.retakeButton}>
            <SafeText inline style={styles.retakeButtonText}>
              Upload Different Photo
            </SafeText>
          </Pressable>
        ) : null}
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
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    ...textBase,
    fontSize: 14,
    lineHeight: 20,
    color: colors.secondary,
  },
  shotCard: {
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadow.card,
  },
  portraitImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 280,
    minHeight: 180,
    backgroundColor: '#1C1915',
  },
  captionBox: {
    padding: 12,
    backgroundColor: '#FAF7F2',
  },
  captionText: {
    ...textBase,
    fontSize: 12,
    color: colors.secondary,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  eyeCard: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
    gap: 14,
    ...shadow.card,
  },
  eyeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eyeCrop: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: '#000',
  },
  placeholderCrop: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardInk,
  },
  eyeCropText: {
    ...textBase,
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  eyeName: {
    ...textBase,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  eyeSubtitle: {
    ...textBase,
    fontSize: 12,
    color: colors.muted,
  },
  tableList: {
    gap: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  tableLabel: {
    ...textBase,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    width: 92,
    flexShrink: 0,
  },
  tableValue: {
    ...textBase,
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.secondary,
    textAlign: 'left',
  },
  tableDivider: {
    height: 1,
    backgroundColor: 'rgba(28, 25, 21, 0.06)',
  },
  infoCard: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
    ...shadow.card,
  },
  alertCard: {
    backgroundColor: 'rgba(184, 106, 45, 0.1)',
    borderColor: 'rgba(184, 106, 45, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  alertText: {
    ...textBase,
    fontSize: 13,
    color: colors.warning,
    lineHeight: 18,
  },
  footerNote: {
    ...textBase,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    fontStyle: 'italic',
    paddingHorizontal: 4,
  },
  bottomBar: {
    gap: 10,
    marginTop: 8,
  },
  proceedButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  proceedButtonText: {
    ...textBase,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  retakeButton: {
    backgroundColor: '#FAF7F2',
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeButtonText: {
    ...textBase,
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
