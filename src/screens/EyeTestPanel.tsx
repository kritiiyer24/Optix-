/** Author: BinaryBeast1209 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { useFaceEngine } from '../auth/FaceEngine';
import { uriToDataUrl } from '../auth/imageData';
import { interpretEyes } from '../scan/measure';
import { saveScan } from '../scan/store';
import type { ScanRecord } from '../scan/types';
import {
  SNELLEN_LEVELS,
  type AcuityConfirmedReport,
  type ClinicalCondition,
  loadLatestAcuity,
  saveAcuityReport,
  synthesizeAcuityWithScan,
} from '../scan/acuityStore';
import { colors, radius, textBase } from '../theme';
import { Button } from '../ui/Button';
import { SafeText } from '../ui/SafeText';
import { Type } from '../ui/Type';
import { useLayout } from '../ui/useLayout';
import { ScanPanel } from './ScanPanel';
import { syncPhotoToMongoDB } from '../scan/cloudSync';
import { PhotorefractionAnalysisView } from './PhotorefractionAnalysisView';
import { calculatePhotorefractionAnalysis } from '../scan/photorefractionCalculator';
import type { PhotorefractionAnalysis } from '../scan/types';

type Direction = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

type CharMode = 'mixed' | 'upper' | 'numbers' | 'tumbling';

const UPPER_CHARS = ['E', 'F', 'P', 'T', 'O', 'Z', 'L', 'D', 'C', 'B', 'H', 'K', 'N', 'R', 'V'];
const NUMBER_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9'];
const MIXED_BANK = ['A', '7', 'b', 'K', '3', 'E', '8', 'd', 'H', '5', 'n', 'R', '9', 'p', '2', 'T', 'C', '4', 'z'];

const DISTANCE_PRESETS = [
  { m: 3.0, label: '🧍 Distance Standard (3.0 m / 10 ft)', short: '3.0 m (10 ft) — Rec' },
  { m: 2.5, label: '🚶 Bedroom (2.5 m / 8 ft)', short: '2.5 m (8 ft)' },
  { m: 2.0, label: '🚪 Compact Space (2.0 m / 6.6 ft)', short: '2.0 m (6.6 ft)' },
];

const CHAR_PRESETS: { mode: CharMode; label: string }[] = [
  { mode: 'mixed', label: '🔤 Mixed (A, 7, b)' },
  { mode: 'upper', label: '🔠 Uppercase Letters' },
  { mode: 'numbers', label: '🔢 Numbers (2-9)' },
  { mode: 'tumbling', label: '🧭 Tumbling E' },
];

const MAX_QUESTIONS_PER_EYE = 8;

type Props = {
  scans: ScanRecord[];
  onSavedScans?: (scans: ScanRecord[]) => void;
  onDone?: () => void;
};

type ViewState = 'scan_required' | 'photo_analysis' | 'guided_cam' | 'setup' | 'parking' | 'active' | 'switch' | 'report';

function TumblingE({ size, direction }: { size: number; direction: Direction }) {
  const rotation = { right: '0deg', down: '90deg', left: '180deg', up: '270deg' }[direction];
  const stroke = Math.max(3, Math.round(size / 5));

  return (
    <View
      style={{
        width: size,
        height: size,
        transform: [{ rotate: rotation }],
        position: 'relative',
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: stroke, backgroundColor: colors.text }} />
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, height: stroke, backgroundColor: colors.text }} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: Math.round(size / 2 - stroke / 2),
          width: Math.round(size * 0.75),
          height: stroke,
          backgroundColor: colors.text,
        }}
      />
      <View style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: stroke, backgroundColor: colors.text }} />
    </View>
  );
}

export function EyeTestPanel({ scans, onSavedScans, onDone }: Props) {
  const { compact, narrow, short, isTablet, cameraViewportHeight } = useLayout();
  const hasInitialScan = scans.length > 0;
  const [latestAnalysis, setLatestAnalysis] = useState<PhotorefractionAnalysis | null>(() => {
    return scans.length > 0 && scans[scans.length - 1].analysis
      ? scans[scans.length - 1].analysis!
      : null;
  });
  const [view, setView] = useState<ViewState>('scan_required');
  const [distanceM, setDistanceM] = useState(3.0);
  const [charMode, setCharMode] = useState<CharMode>('mixed');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Photo upload state
  const { ready: engineReady, screenFromDataUrl } = useFaceEngine();
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Camera permissions & parking HUD state
  const [permission, requestPermission] = useCameraPermissions();
  const [parkingActive, setParkingActive] = useState(false);
  const [lockPct, setLockPct] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Exam state
  const [eye, setEye] = useState<'right' | 'left'>('right');
  const [levelIndex, setLevelIndex] = useState(0);
  const [trialIndex, setTrialIndex] = useState(0);
  const [levelCorrect, setLevelCorrect] = useState(0);
  const [eyeQuestionNumber, setEyeQuestionNumber] = useState(1);
  const [overallAnswered, setOverallAnswered] = useState(0);

  // Current Optotype
  const [direction, setDirection] = useState<Direction>('right');
  const [currentChar, setCurrentChar] = useState('E');
  const [choices, setChoices] = useState<string[]>([]);

  // Results & Scorecard
  const [results, setResults] = useState<{ right: string; left: string }>({ right: '20/20', left: '20/20' });
  const [report, setReport] = useState<AcuityConfirmedReport | null>(null);

  // Pulse animation for parking HUD
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadLatestAcuity().then((existing) => {
      if (existing) setReport(existing);
    });
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  // Clean up lock timer on unmount
  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  }, []);

  const speak = (text: string) => {
    if (!voiceEnabled) return;
    Speech.stop().catch(() => undefined);
    try {
      Speech.speak(text, { rate: 1.02 });
    } catch {
      // Speech unsupported or muted
    }
  };

  const getOptotypeSize = (den: number) => {
    // Calibrated 5-arcminute Snellen scaling (6.3 display points per mm):
    // At distanceM, a 20/20 optotype height is: distanceM * 1.4544 mm * 6.3 pt/mm ≈ distanceM * 9.16 pt
    const base20_20 = Math.round(distanceM * 9.16);
    return Math.max(14, Math.round(base20_20 * (den / 20)));
  };

  const getRandomDistractors = (correct: string, count = 3): string[] => {
    let pool = MIXED_BANK;
    if (charMode === 'upper') pool = UPPER_CHARS;
    else if (charMode === 'numbers') pool = NUMBER_CHARS;
    else if (charMode === 'tumbling') pool = DIRECTIONS;

    const filtered = pool.filter((c) => c !== correct);
    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const nextTrial = () => {
    if (charMode === 'tumbling') {
      let next: Direction;
      do {
        next = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      } while (next === direction && DIRECTIONS.length > 1);
      setDirection(next);
      setCurrentChar(next);
    } else {
      let pool = MIXED_BANK;
      if (charMode === 'upper') pool = UPPER_CHARS;
      else if (charMode === 'numbers') pool = NUMBER_CHARS;

      let next: string;
      do {
        next = pool[Math.floor(Math.random() * pool.length)];
      } while (next === currentChar && pool.length > 1);
      setCurrentChar(next);

      const distractors = getRandomDistractors(next, 3);
      setChoices([next, ...distractors].sort(() => 0.5 - Math.random()));
    }
  };

  // Upload photo from Camera Roll / Photos App
  const pickPhotoFromGallery = async () => {
    try {
      setUploadError('');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      setUploading(true);
      setUploadMessage('Verifying photo for human face and ocular red reflex...');
      const photoUri = result.assets[0].uri;
      const dataUrl = await uriToDataUrl(photoUri);

      // 1. Strict human face & eye landmark detection
      const eyes = await screenFromDataUrl(dataUrl);

      // 2. Clinical red reflex & quality verification
      const res = interpretEyes(eyes.left, eyes.right);
      if ('message' in res) {
        setUploadError(res.message);
        setUploadMessage(res.message);
        return;
      }

      // 3. Generate detailed Photorefraction Screening Analysis (matching web app)
      const analysis = calculatePhotorefractionAnalysis(
        eyes.left,
        eyes.right,
        photoUri,
        (eyes as any).annotatedUrl,
        distanceM,
      );
      setLatestAnalysis(analysis);

      // 4. Sync to database once verified
      syncPhotoToMongoDB(dataUrl, 'gallery_upload');

      const saved = await saveScan({
        id: `${Date.now()}`,
        at: new Date().toISOString(),
        readings: res.readings,
        analysis,
      });
      onSavedScans?.(saved);
      setUploadMessage('Photo analysis complete!');
      speak('Photo analyzed. Review your photorefraction screening analysis.');
      // SHOW PHOTOREFRACTION ANALYSIS SCREEN FIRST!
      setView('photo_analysis');
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      const msg = rawMsg.toLowerCase().includes('database') || rawMsg.toLowerCase().includes('disk')
        ? 'Device cache was full. Cache has been trimmed. Please try selecting the photo again.'
        : rawMsg || 'No human face detected. Only clear human portrait photos with visible eyes are accepted.';
      setUploadError(msg);
      setUploadMessage(msg);
    } finally {
      setUploading(false);
    }
  };

  const startParkingGuide = async () => {
    if (scans.length === 0) {
      setView('scan_required');
      return;
    }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        startTest('right');
        return;
      }
    }
    setParkingActive(true);
    setView('parking');
    setLockPct(0);
    speak(`Place the phone on a table or shelf. Step back ${distanceM} meters.`);

    let pct = 0;
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    lockTimerRef.current = setInterval(() => {
      pct += 4;
      if (pct === 24) {
        speak(`Step back to ${distanceM} meters.`);
      } else if (pct === 68) {
        speak('Looking good! Hold steady.');
      } else if (pct >= 100) {
        if (lockTimerRef.current) clearInterval(lockTimerRef.current);
        setLockPct(100);
        speak(`In position at ${distanceM} meters! Starting right eye test.`);
        setTimeout(() => {
          startTest('right');
        }, 1200);
      }
      setLockPct(Math.min(100, pct));
    }, 280);
  };

  const skipToTest = () => {
    if (scans.length === 0) {
      setView('scan_required');
      return;
    }
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    startTest('right');
  };

  const startTest = (targetEye: 'right' | 'left') => {
    if (scans.length === 0) {
      setView('scan_required');
      return;
    }
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    setEye(targetEye);
    setLevelIndex(0);
    setTrialIndex(0);
    setLevelCorrect(0);
    setEyeQuestionNumber(1);
    if (targetEye === 'right') {
      setOverallAnswered(0);
    }
    nextTrial();
    setView('active');

    if (targetEye === 'right') {
      speak('Cover your left eye with your palm. Select the character or arrow you see.');
    } else {
      speak('Now switch: Cover your right eye with your palm. Select the character you see.');
    }
  };

  // Fast Adaptive Answer Evaluator
  const handleAnswer = (answer: string) => {
    let isCorrect = false;
    if (charMode === 'tumbling') {
      isCorrect = answer === direction;
    } else {
      isCorrect = answer.trim().toLowerCase() === currentChar.trim().toLowerCase();
    }

    const newCorrect = isCorrect ? levelCorrect + 1 : levelCorrect;
    if (isCorrect) setLevelCorrect(newCorrect);

    const newTrial = trialIndex + 1;
    const newQuestionNum = eyeQuestionNumber + 1;
    const newOverall = overallAnswered + 1;

    setTrialIndex(newTrial);
    setEyeQuestionNumber(newQuestionNum);
    setOverallAnswered(newOverall);

    const reachedTwoCorrect = newCorrect >= 2;
    const reachedTwoMistakes = newTrial - newCorrect >= 2;
    const finishedThreeTrials = newTrial >= 3;
    const reachedMaxQuestions = newQuestionNum > MAX_QUESTIONS_PER_EYE;

    if (reachedTwoCorrect) {
      const passedLevel = SNELLEN_LEVELS[levelIndex].label;
      const updated = { ...results, [eye]: passedLevel };
      setResults(updated);

      if (levelIndex + 1 < SNELLEN_LEVELS.length && !reachedMaxQuestions) {
        setLevelIndex(levelIndex + 1);
        setTrialIndex(0);
        setLevelCorrect(0);
        speak('Correct! Advancing to sharper line.');
        nextTrial();
      } else {
        finishEye(updated);
      }
    } else if (reachedTwoMistakes || finishedThreeTrials || reachedMaxQuestions) {
      const failedLevel = levelIndex === 0 ? '20/100 or less' : SNELLEN_LEVELS[levelIndex - 1].label;
      const updated = { ...results, [eye]: failedLevel };
      setResults(updated);
      finishEye(updated);
    } else {
      nextTrial();
    }
  };

  const finishEye = (currentResults: { right: string; left: string }) => {
    if (eye === 'right') {
      setView('switch');
      speak(`Right eye completed: ${currentResults.right}. Now switch eyes.`);
    } else {
      const latestScan = scans.length > 0 ? scans[scans.length - 1] : undefined;
      const rep = synthesizeAcuityWithScan(currentResults.right, currentResults.left, distanceM, latestScan);
      setReport(rep);
      saveAcuityReport(rep).catch(() => undefined);
      setView('report');
      speak('Exam complete. Your comprehensive clinical scorecard is ready.');
    }
  };

  const currentLevel = SNELLEN_LEVELS[levelIndex] ?? SNELLEN_LEVELS[0];
  const optotypeSize = getOptotypeSize(currentLevel.den);
  const totalQuestions = MAX_QUESTIONS_PER_EYE * 2;
  const progressPct = Math.min(95, Math.round((overallAnswered / totalQuestions) * 100));

  return (
    <View style={styles.container}>
      {/* =================================================================== */}
      {/* 0. PHASE 1: SCAN / UPLOAD REQUIRED GATE                             */}
      {/* =================================================================== */}
      {view === 'scan_required' ? (
        <View style={styles.card}>
          <Type variant="kicker">Phase 1 of 2: Ocular Red Reflex Scan</Type>
          <Type variant="title" style={styles.cardTitle}>
            Photo Scan Required
          </Type>
          <SafeText style={styles.cardBody}>
            Before taking the interactive vision chart exam, Optix must detect the red reflex in both eyes from a flash photo.
            Upload any flash photo from your camera roll, or take one now with the camera.
          </SafeText>

          {/* Status Badge */}
          <View style={styles.lockNoticeBox}>
            <SafeText style={styles.lockNoticeTitle}>🔒 Eye Exam Locked</SafeText>
            <SafeText style={styles.lockNoticeBody}>
              {scans.length === 0
                ? 'An ocular photo scan is required before proceeding to the distance acuity reading test.'
                : `You have ${scans.length} previous scan(s) on file, or you can upload a fresh photo below.`}
            </SafeText>
          </View>

          {/* Upload Status / Error */}
          {uploading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 }}>
              <ActivityIndicator color={colors.accent} />
              <SafeText style={{ color: colors.accentDeep, fontSize: 13, fontWeight: '600' }}>
                {uploadMessage}
              </SafeText>
            </View>
          ) : null}

          {uploadError ? (
            <View style={styles.alertBox}>
              <SafeText style={styles.alertTitle}>⚠️ Could Not Read Photo</SafeText>
              <SafeText style={styles.alertBody}>{uploadError}</SafeText>
            </View>
          ) : null}

          {/* Action Options */}
          <View style={{ gap: 10, marginTop: 4 }}>
            <Button
              label={uploading ? 'Analyzing...' : '🖼️ Upload Photo from Camera Roll'}
              onPress={pickPhotoFromGallery}
              disabled={uploading || !engineReady}
            />
            <Button
              label="📷 Take Guided Flash Photo with Camera"
              variant="ghost"
              onPress={() => setView('guided_cam')}
              disabled={uploading}
            />
            {latestAnalysis ? (
              <Button
                label="👁️ View Photorefraction Analysis (Marked Eyes & Diopters)"
                onPress={() => setView('photo_analysis')}
              />
            ) : null}
            {scans.length > 0 ? (
              <Button
                label="Use Previous Scan & Continue →"
                variant="ghost"
                onPress={() => setView('setup')}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {/* =================================================================== */}
      {/* 0A. PHOTOREFRACTION SCREENING ANALYSIS (AFTER PHOTO UPLOAD)          */}
      {/* =================================================================== */}
      {view === 'photo_analysis' && latestAnalysis ? (
        <PhotorefractionAnalysisView
          analysis={latestAnalysis}
          onProceed={() => {
            speak('Starting doctor reading test. Select your distance.');
            setView('setup');
          }}
          onRetake={() => setView('scan_required')}
        />
      ) : null}

      {/* =================================================================== */}
      {/* 0B. GUIDED CAMERA SCAN (PHASE 1)                                   */}
      {/* =================================================================== */}
      {view === 'guided_cam' ? (
        <View style={styles.card}>
          <ScanPanel
            scans={scans}
            onSaved={(updated) => {
              onSavedScans?.(updated);
              if (updated.length > 0 && updated[updated.length - 1].analysis) {
                setLatestAnalysis(updated[updated.length - 1].analysis!);
                setView('photo_analysis');
              }
            }}
            onGoToTest={() => setView('setup')}
          />
          <View style={{ marginTop: 10 }}>
            <Button
              label="← Back to Scan Options"
              variant="ghost"
              onPress={() => setView('scan_required')}
            />
          </View>
        </View>
      ) : null}

      {/* =================================================================== */}
      {/* 1. SETUP VIEW: PRESETS & UNLOCKED START                             */}
      {/* =================================================================== */}
      {view === 'setup' ? (
        <View style={styles.card}>
          <Type variant="kicker">Phase 2 of 2: Clinical Acuity Exam</Type>
          <Type variant="title" style={styles.cardTitle}>
            Doctor’s Vision Reading Test
          </Type>

          {/* Scan Verified Banner */}
          <View style={styles.verifiedBanner}>
            <SafeText style={styles.verifiedTitle}>🟢 Ocular Red Reflex Verified</SafeText>
            <SafeText style={styles.verifiedBody}>
              Objective photorefraction scan on file. Now measure reading acuity to cross-verify all 8 clinical conditions.
            </SafeText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
              {latestAnalysis ? (
                <Pressable onPress={() => setView('photo_analysis')}>
                  <SafeText inline style={{ fontSize: 12, color: colors.accent, fontWeight: '700', textDecorationLine: 'underline' }}>
                    🔍 View Photo Analysis Report
                  </SafeText>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setView('scan_required')}>
                <SafeText inline style={{ fontSize: 12, color: colors.accentDeep, fontWeight: '700', textDecorationLine: 'underline' }}>
                  📷 Upload New Photo
                </SafeText>
              </Pressable>
            </View>
          </View>

          {/* Distance Presets */}
          <View style={styles.section}>
            <SafeText style={styles.sectionHeader}>1. Standing Distance</SafeText>
            <View style={styles.pillsRow}>
              {DISTANCE_PRESETS.map((p) => {
                const active = distanceM === p.m;
                return (
                  <Pressable
                    key={p.m}
                    onPress={() => setDistanceM(p.m)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <SafeText inline style={[styles.pillText, active && styles.pillTextActive]}>
                      {compact ? p.short : p.label}
                    </SafeText>
                  </Pressable>
                );
              })}
            </View>
            <SafeText style={styles.distGuide}>
              {`Place phone on a table or shelf at eye level. Step back ${distanceM.toFixed(1)} meters (~${(distanceM * 3.3).toFixed(1)} ft). Do not hold phone in hand for distance screening.`}
            </SafeText>
          </View>

          {/* Chart Character Styles */}
          <View style={styles.section}>
            <SafeText style={styles.sectionHeader}>2. Chart Characters</SafeText>
            <View style={styles.pillsRow}>
              {CHAR_PRESETS.map((c) => {
                const active = charMode === c.mode;
                return (
                  <Pressable
                    key={c.mode}
                    onPress={() => setCharMode(c.mode)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <SafeText inline style={[styles.pillText, active && styles.pillTextActive]}>
                      {c.label}
                    </SafeText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Voice Feedback Toggle */}
          <View style={[styles.section, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <SafeText style={styles.sectionHeader}>3. Audio Guidance</SafeText>
            <Pressable
              onPress={() => setVoiceEnabled(!voiceEnabled)}
              style={[styles.smallPill, voiceEnabled && styles.smallPillActive]}
            >
              <SafeText inline style={[styles.smallPillText, voiceEnabled && styles.smallPillTextActive]}>
                {voiceEnabled ? '🔊 Voice Feedback: ON' : '🔇 Voice Feedback: OFF'}
              </SafeText>
            </Pressable>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 8, marginTop: 8 }}>
            <Button label="🎥 Start Camera Parking Guide" onPress={startParkingGuide} />
            <Button label="I'm Ready (Skip to Test) →" variant="ghost" onPress={skipToTest} />
          </View>

          {report ? (
            <View style={{ marginTop: 6 }}>
              <Button label="View Latest Confirmed Scorecard" variant="ghost" onPress={() => setView('report')} />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* =================================================================== */}
      {/* 2. CAMERA PARKING GUIDANCE HUD                                      */}
      {/* =================================================================== */}
      {view === 'parking' ? (
        <View style={styles.card}>
          <Type variant="kicker">Automated Distance HUD</Type>
          <Type variant="title" style={styles.cardTitle}>
            Camera Distance Guidance
          </Type>
          <SafeText style={styles.cardBody}>
            Prop your phone at eye level on a shelf or desk, then step back to <SafeText inline style={{ fontWeight: '700' }}>{distanceM} m (~{(distanceM * 3.3).toFixed(0)} ft)</SafeText>.
            The radar is counting down as you step into position!
          </SafeText>

          {/* Camera Viewport with HUD Overlay */}
          <View style={[styles.cameraViewport, { height: cameraViewportHeight }]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="front"
              animateShutter={false}
            />

            {/* Overlay Layer */}
            <View style={styles.cameraOverlay}>
              {/* Top HUD */}
              <View style={styles.hudTopRow}>
                <View style={styles.hudPill}>
                  <SafeText inline style={styles.hudPillText}>
                    📡 Target: {distanceM} m
                  </SafeText>
                </View>
                <View style={[styles.hudPill, lockPct >= 50 && styles.hudPillSuccess]}>
                  <SafeText inline style={styles.hudPillText}>
                    {lockPct >= 80 ? '🟢 In Position!' : '🎯 Adjusting...'}
                  </SafeText>
                </View>
              </View>

              {/* Glowing Parking Target Box */}
              <Animated.View
                style={[
                  styles.parkingTargetBox,
                  {
                    width: short ? 120 : 150,
                    height: short ? 90 : 120,
                    transform: [{ scale: pulseAnim }],
                    borderColor: lockPct >= 60 ? '#10B981' : colors.accent,
                  },
                ]}
              >
                <SafeText style={styles.parkingBoxLabel}>
                  {lockPct >= 60 ? `PARKED (${distanceM} m)` : 'Target Zone'}
                </SafeText>
              </Animated.View>

              {/* Bottom Lock Progress */}
              <View style={styles.hudBottomBox}>
                <View style={styles.lockProgressBar}>
                  <View style={[styles.lockProgressFill, { width: `${lockPct}%` }]} />
                </View>
                <View style={styles.hudBottomTextRow}>
                  <SafeText style={styles.hudCueText}>
                    {lockPct >= 80 ? 'Hold still! Calibrating...' : `Stand at ${distanceM} m until locked`}
                  </SafeText>
                  <SafeText style={styles.hudPctText}>{lockPct}%</SafeText>
                </View>
              </View>
            </View>
          </View>

          {/* Skip Bypass Button */}
          <Button label="I'm Ready (Skip to Test) →" onPress={skipToTest} />
        </View>
      ) : null}

      {/* =================================================================== */}
      {/* 3. ACTIVE VISION EXAM                                               */}
      {/* =================================================================== */}
      {view === 'active' ? (
        <View style={styles.card}>
          {/* Live 4-Step Stepper & Progress Fill */}
          <View style={styles.progressCard}>
            <View style={styles.stepperRow}>
              <View style={[styles.stepPill, styles.stepPillDone]}>
                <SafeText inline style={styles.stepPillTextDone}>1. Reflex 🟢</SafeText>
              </View>
              <View style={[styles.stepPill, eye === 'right' ? styles.stepPillActive : styles.stepPillDone]}>
                <SafeText inline style={eye === 'right' ? styles.stepPillTextActive : styles.stepPillTextDone}>
                  2. Right (OD)
                </SafeText>
              </View>
              <View style={[styles.stepPill, eye === 'left' ? styles.stepPillActive : styles.stepPillIdle]}>
                <SafeText inline style={eye === 'left' ? styles.stepPillTextActive : styles.stepPillTextIdle}>
                  3. Left (OS)
                </SafeText>
              </View>
              <View style={[styles.stepPill, styles.stepPillIdle]}>
                <SafeText inline style={styles.stepPillTextIdle}>4. Scorecard 📋</SafeText>
              </View>
            </View>

            {/* Fill Bar */}
            <View style={styles.examFillContainer}>
              <View style={[styles.examFillBar, { width: `${Math.max(8, progressPct)}%` }]} />
            </View>

            <View style={styles.examProgressLabels}>
              <SafeText style={[styles.examProgressText, { flex: 1, flexShrink: 1 }]}>
                {compact ? (eye === 'right' ? 'OD (Right)' : 'OS (Left)') : (eye === 'right' ? 'Right Eye (OD)' : 'Left Eye (OS)')} — Q{eyeQuestionNumber}/{MAX_QUESTIONS_PER_EYE}
              </SafeText>
              <SafeText style={[styles.examProgressPct, { flexShrink: 0 }]}>{progressPct}%</SafeText>
            </View>
          </View>

          {/* Eye Prompt Banner */}
          <View style={styles.eyeBanner}>
            <SafeText style={styles.eyeBannerTitle}>
              {eye === 'right' ? 'Cover your LEFT EYE with your palm' : 'Cover your RIGHT EYE with your palm'}
            </SafeText>
            <SafeText style={styles.eyeBannerSub}>
              Testing {eye === 'right' ? 'RIGHT EYE (OD)' : 'LEFT EYE (OS)'} at {distanceM} m. Do not squint.
            </SafeText>
          </View>

          {/* Optotype Display Stage */}
          <View style={styles.stage}>
            <View style={styles.stageBar}>
              <View style={styles.tag}>
                <SafeText inline style={styles.tagText}>
                  Acuity: {currentLevel.label}
                </SafeText>
              </View>
              <SafeText inline style={styles.trialText}>
                Question {eyeQuestionNumber} of {MAX_QUESTIONS_PER_EYE}
              </SafeText>
            </View>

            {/* Optotype Rendering */}
            <View style={styles.optotypeBox}>
              {charMode === 'tumbling' ? (
                <TumblingE size={optotypeSize} direction={direction} />
              ) : (
                <SafeText
                  style={{
                    fontSize: optotypeSize,
                    fontWeight: '800',
                    color: colors.text,
                    textAlign: 'center',
                    includeFontPadding: false,
                  }}
                >
                  {currentChar}
                </SafeText>
              )}
            </View>
          </View>

          {/* Interactive Response Grid */}
          {charMode === 'tumbling' ? (
            <View>
              <SafeText style={styles.dpadPrompt}>Which direction is the E pointing? Tap button:</SafeText>
              <View style={styles.dpadGrid}>
                <View style={styles.dpadRow}>
                  <Pressable style={styles.dpadBtn} onPress={() => handleAnswer('up')}>
                    <SafeText style={styles.dpadArrow}>▲</SafeText>
                    <SafeText style={styles.dpadLabel}>UP</SafeText>
                  </Pressable>
                </View>
                <View style={styles.dpadMiddleRow}>
                  <Pressable style={styles.dpadBtn} onPress={() => handleAnswer('left')}>
                    <SafeText style={styles.dpadArrow}>◀</SafeText>
                    <SafeText style={styles.dpadLabel}>LEFT</SafeText>
                  </Pressable>
                  <View style={styles.dpadSpacer} />
                  <Pressable style={styles.dpadBtn} onPress={() => handleAnswer('right')}>
                    <SafeText style={styles.dpadArrow}>▶</SafeText>
                    <SafeText style={styles.dpadLabel}>RIGHT</SafeText>
                  </Pressable>
                </View>
                <View style={styles.dpadRow}>
                  <Pressable style={styles.dpadBtn} onPress={() => handleAnswer('down')}>
                    <SafeText style={styles.dpadArrow}>▼</SafeText>
                    <SafeText style={styles.dpadLabel}>DOWN</SafeText>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View>
              <SafeText style={styles.dpadPrompt}>What character do you see? Tap your answer:</SafeText>
              <View style={styles.choiceGrid}>
                {choices.map((choice, idx) => (
                  <Pressable
                    key={`${choice}-${idx}`}
                    style={[styles.choiceBtn, narrow && { height: 48, minWidth: '46%' }]}
                    onPress={() => handleAnswer(choice)}
                  >
                    <SafeText style={styles.choiceBtnText}>{choice}</SafeText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      ) : null}

      {/* =================================================================== */}
      {/* 4. SWITCH EYE PROMPT                                                */}
      {/* =================================================================== */}
      {view === 'switch' ? (
        <View style={[styles.card, { alignItems: 'center' }]}>
          <SafeText style={{ fontSize: 38, marginBottom: 6 }}>👏</SafeText>
          <Type variant="title" style={{ textAlign: 'center' }}>
            Right Eye Completed!
          </Type>
          <SafeText style={styles.scoreHighlight}>Measured Acuity: {results.right}</SafeText>

          <View style={[styles.eyeBanner, { alignSelf: 'stretch', marginVertical: 14 }]}>
            <SafeText style={styles.eyeBannerTitle}>Now switch: Cover your RIGHT EYE with your palm</SafeText>
            <SafeText style={styles.eyeBannerSub}>Look at the phone with your LEFT EYE (OS). Keep head level.</SafeText>
          </View>

          <Button label="Continue Test (Left Eye) →" onPress={() => startTest('left')} />
        </View>
      ) : null}

      {/* =================================================================== */}
      {/* 5. CONFIRMED 8-CONDITION CLINICAL SCORECARD REPORT                  */}
      {/* =================================================================== */}
      {view === 'report' && report ? (
        <View style={styles.card}>
          <View style={styles.reportHead}>
            <Type variant="kicker">Official Vision Assessment</Type>
            <Type variant="title" style={{ fontSize: 22, marginTop: 4 }}>
              Confirmed Clinical Scorecard
            </Type>
            <View
              style={[
                styles.badgePill,
                report.overallBadge === 'success' && styles.badgeSuccess,
                report.overallBadge === 'warning' && styles.badgeWarning,
                report.overallBadge === 'danger' && styles.badgeDanger,
                report.overallBadge === 'info' && styles.badgeInfo,
              ]}
            >
              <SafeText inline style={styles.badgePillText}>
                {report.overallStatus}
              </SafeText>
            </View>
          </View>

          {/* Bilateral Comparison Matrix */}
          <View style={styles.matrix}>
            <View style={styles.matrixRow}>
              <View style={styles.matrixCol}>
                <SafeText style={styles.matrixEye}>Right Eye (OD)</SafeText>
                <SafeText style={[styles.matrixScore, narrow && { fontSize: 18 }]}>{report.rightAcuity}</SafeText>
                <SafeText style={styles.matrixStatus}>{report.rightStatus}</SafeText>
                <SafeText style={styles.matrixExpl}>{report.rightExplanation}</SafeText>
              </View>
              <View style={styles.matrixDivider} />
              <View style={styles.matrixCol}>
                <SafeText style={styles.matrixEye}>Left Eye (OS)</SafeText>
                <SafeText style={[styles.matrixScore, narrow && { fontSize: 18 }]}>{report.leftAcuity}</SafeText>
                <SafeText style={styles.matrixStatus}>{report.leftStatus}</SafeText>
                <SafeText style={styles.matrixExpl}>{report.leftExplanation}</SafeText>
              </View>
            </View>
          </View>

          {/* Amblyopia Alert Box */}
          {report.amblyopiaRisk ? (
            <View style={styles.alertBox}>
              <SafeText style={styles.alertTitle}>⚠️ Amblyopia / Asymmetry Flag</SafeText>
              <SafeText style={styles.alertBody}>{report.amblyopiaReason}</SafeText>
            </View>
          ) : null}

          {/* 8-Condition Clinical Spectrum Scorecard */}
          <View style={styles.conditionsSection}>
            <SafeText style={styles.conditionsHeading}>Clinical Condition Scorecard (8 Conditions)</SafeText>
            <SafeText style={styles.conditionsSub}>
              Cross-verified with objective red reflex photorefraction and calibrated reading acuity.
            </SafeText>

            <View style={styles.conditionsGrid}>
              {(report.conditions || []).map((c: ClinicalCondition) => (
                <View key={c.id} style={styles.conditionCard}>
                  <View style={styles.conditionHead}>
                    <SafeText style={[styles.conditionName, { flex: 1, marginRight: 8 }]}>
                      {c.icon} {c.name}
                    </SafeText>
                    <View
                      style={[
                        styles.miniBadge,
                        c.badge === 'success' && styles.badgeSuccess,
                        c.badge === 'warning' && styles.badgeWarning,
                        c.badge === 'danger' && styles.badgeDanger,
                        c.badge === 'info' && styles.badgeInfo,
                      ]}
                    >
                      <SafeText inline style={styles.miniBadgeText}>
                        {c.status}
                      </SafeText>
                    </View>
                  </View>
                  <SafeText style={styles.conditionVal}>{c.value}</SafeText>
                  <SafeText style={styles.conditionExpl}>{c.explanation}</SafeText>
                </View>
              ))}
            </View>
          </View>

          {/* Doctor's Recommendation Box */}
          <View style={styles.recBox}>
            <SafeText style={styles.recTitle}>🩺 Doctor’s Action Plan</SafeText>
            <SafeText style={styles.recBody}>{report.recommendation}</SafeText>
          </View>

          <View style={{ gap: 8, marginTop: 12 }}>
            <Button label="Retest Vision Exam" variant="ghost" onPress={() => setView('setup')} />
            {onDone ? <Button label="Done / Back to Home" onPress={onDone} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    fontSize: 22,
    color: colors.text,
  },
  cardBody: {
    ...textBase,
    fontSize: 14,
    lineHeight: 20,
    color: colors.secondary,
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
    gap: 6,
  },
  sectionHeader: {
    ...textBase,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillText: {
    ...textBase,
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
  },
  pillTextActive: {
    color: '#fff',
  },
  smallPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  smallPillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  smallPillText: {
    ...textBase,
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
  },
  smallPillTextActive: {
    color: colors.accentDeep,
  },
  distGuide: {
    ...textBase,
    fontSize: 13,
    color: colors.accentDeep,
    fontWeight: '500',
  },
  lockNoticeBox: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.button,
    padding: 14,
    gap: 4,
  },
  lockNoticeTitle: {
    ...textBase,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  lockNoticeBody: {
    ...textBase,
    fontSize: 13,
    lineHeight: 18,
    color: colors.secondary,
  },
  verifiedBanner: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.button,
    padding: 12,
    gap: 4,
  },
  verifiedTitle: {
    ...textBase,
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
  },
  verifiedBody: {
    ...textBase,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
  },
  cameraViewport: {
    height: 240,
    borderRadius: radius.camera,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    marginVertical: 6,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    justifyContent: 'space-between',
  },
  hudTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudPill: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hudPillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    borderColor: '#10B981',
  },
  hudPillText: {
    ...textBase,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  parkingTargetBox: {
    alignSelf: 'center',
    width: 150,
    height: 120,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31, 107, 99, 0.12)',
  },
  parkingBoxLabel: {
    ...textBase,
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hudBottomBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.button,
    padding: 10,
    gap: 4,
  },
  lockProgressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  lockProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  hudBottomTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudCueText: {
    ...textBase,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  hudPctText: {
    ...textBase,
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  progressCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  stepPill: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPillDone: {
    backgroundColor: colors.successSoft,
  },
  stepPillActive: {
    backgroundColor: colors.accent,
  },
  stepPillIdle: {
    backgroundColor: colors.card,
  },
  stepPillTextDone: {
    ...textBase,
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },
  stepPillTextActive: {
    ...textBase,
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  stepPillTextIdle: {
    ...textBase,
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
  examFillContainer: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  examFillBar: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  examProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examProgressText: {
    ...textBase,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  examProgressPct: {
    ...textBase,
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  eyeBanner: {
    backgroundColor: colors.accentSoft,
    padding: 12,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: 4,
  },
  eyeBannerTitle: {
    ...textBase,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  eyeBannerSub: {
    ...textBase,
    fontSize: 12,
    color: colors.secondary,
  },
  stage: {
    backgroundColor: '#fff',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  stageBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tag: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    ...textBase,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  trialText: {
    ...textBase,
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  optotypeBox: {
    marginVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadPrompt: {
    ...textBase,
    fontSize: 13,
    color: colors.secondary,
    textAlign: 'center',
    marginVertical: 4,
    fontWeight: '600',
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  choiceBtn: {
    flex: 1,
    minWidth: '45%',
    height: 52,
    backgroundColor: colors.bg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBtnText: {
    ...textBase,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  dpadGrid: {
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  dpadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  dpadSpacer: {
    width: 60,
  },
  dpadBtn: {
    width: 72,
    height: 52,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadArrow: {
    fontSize: 18,
    color: colors.text,
  },
  dpadLabel: {
    ...textBase,
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  scoreHighlight: {
    ...textBase,
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    marginVertical: 4,
  },
  reportHead: {
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 12,
  },
  badgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    marginTop: 4,
  },
  badgeSuccess: {
    backgroundColor: colors.successSoft,
  },
  badgeWarning: {
    backgroundColor: colors.warningSoft,
  },
  badgeDanger: {
    backgroundColor: '#FCE8E6',
  },
  badgeInfo: {
    backgroundColor: '#E8F0FE',
  },
  badgePillText: {
    ...textBase,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  matrix: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.button,
    padding: 12,
    backgroundColor: '#FAF7F2',
  },
  matrixRow: {
    flexDirection: 'row',
    gap: 12,
  },
  matrixCol: {
    flex: 1,
    gap: 4,
  },
  matrixDivider: {
    width: 1,
    backgroundColor: colors.line,
  },
  matrixEye: {
    ...textBase,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  matrixScore: {
    ...textBase,
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
  },
  matrixStatus: {
    ...textBase,
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  matrixExpl: {
    ...textBase,
    fontSize: 11,
    lineHeight: 15,
    color: colors.muted,
  },
  alertBox: {
    backgroundColor: '#FCE8E6',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.button,
    padding: 12,
    gap: 4,
  },
  alertTitle: {
    ...textBase,
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  alertBody: {
    ...textBase,
    fontSize: 12,
    color: colors.text,
    lineHeight: 17,
  },
  conditionsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
    gap: 8,
  },
  conditionsHeading: {
    ...textBase,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  conditionsSub: {
    ...textBase,
    fontSize: 12,
    color: colors.secondary,
  },
  conditionsGrid: {
    gap: 8,
  },
  conditionCard: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  conditionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  conditionName: {
    ...textBase,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    flexShrink: 1,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  miniBadgeText: {
    ...textBase,
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  conditionVal: {
    ...textBase,
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  conditionExpl: {
    ...textBase,
    fontSize: 11,
    lineHeight: 15,
    color: colors.secondary,
  },
  recBox: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.button,
    padding: 12,
    gap: 4,
  },
  recTitle: {
    ...textBase,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentDeep,
  },
  recBody: {
    ...textBase,
    fontSize: 12,
    lineHeight: 17,
    color: colors.secondary,
  },
});
