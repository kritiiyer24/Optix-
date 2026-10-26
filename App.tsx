/** Author: BinaryBeast1209 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { FaceEngineProvider } from './src/auth/FaceEngine';
import { DebugOverlay } from './src/debug/DebugOverlay';
import { DEBUG_UI } from './src/debug/log';
import { EnrollScreen } from './src/screens/EnrollScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { UnlockScreen } from './src/screens/UnlockScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors, loadWebFonts } from './src/theme';

loadWebFonts();

function Gate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }
  if (status === 'welcome') return <WelcomeScreen />;
  if (status === 'needs-enroll') return <EnrollScreen />;
  if (status === 'locked') return <UnlockScreen />;
  return <HomeScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <FaceEngineProvider>
        <StatusBar style="dark" />
        <Gate />
        {DEBUG_UI ? <DebugOverlay /> : null}
      </FaceEngineProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
