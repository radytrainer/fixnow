import {
  NotoSansKhmer_400Regular, NotoSansKhmer_500Medium, NotoSansKhmer_600SemiBold, NotoSansKhmer_700Bold,
} from '@expo-google-fonts/noto-sans-khmer';
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { useNetInfo } from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n';
import { AuthProvider, useAuth } from './src/lib/auth';
import { CustomerNavigator, TechnicianNavigator } from './src/navigation';
import { Welcome } from './src/screens/shared/Welcome';
import { T } from './src/ui';
import { useI18n } from './src/i18n';
import { colors } from './src/ui/theme';

/** Shown whenever the device reports no connection; screens keep their last data and retry on reconnect. */
function OfflineBanner() {
  const net = useNetInfo();
  const { t } = useI18n();
  if (net.isConnected !== false) return null;
  return (
    <View testID="offline-banner" style={styles.offline}>
      <WifiOff size={16} color={colors.white} />
      <T size={13} weight="semibold" color={colors.white} style={{ flex: 1 }}>{t('notif.offline')}</T>
    </View>
  );
}

function Root() {
  const { ready, me } = useAuth();
  if (!ready) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!me) return <Welcome />;
  // Role-based navigation: each role only ever mounts its own screens.
  if (me.role === 'CUSTOMER') return <CustomerNavigator key={me.id} />;
  if (me.role === 'TECHNICIAN') return <TechnicianNavigator key={`${me.id}-${me.technicianProfile?.status ?? 'NEW'}`} />;
  return <Welcome />; // admins use the web dashboard
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
    NotoSansKhmer_400Regular, NotoSansKhmer_500Medium, NotoSansKhmer_600SemiBold, NotoSansKhmer_700Bold,
  });
  if (!fontsLoaded) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          {/* On web the app renders in a phone-width frame so the mobile UI can be demoed in a browser. */}
          <View style={styles.webFrameOuter}>
            <View style={styles.webFrame}>
              <StatusBar style="dark" />
              <OfflineBanner />
              <Root />
            </View>
          </View>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  offline: { backgroundColor: colors.warning, paddingTop: 36, paddingBottom: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  webFrameOuter: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#E2E8F0' : colors.bg, alignItems: 'center' },
  webFrame: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 430 : undefined, backgroundColor: colors.canvas, overflow: 'hidden' },
});
