import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Figtree_400Regular } from '@expo-google-fonts/figtree';
import { ActivityIndicator } from 'react-native';
import { AppProvider } from '@/providers/AppProvider';
import Access from '@/screens/Access';
import { ToastHost } from '@/components/native-ui';
import { ConfettiHost } from '@/components/celebrate';
import { colors } from '@/theme/tokens';
export default function Layout() {
  const [loaded, error] = useFonts({ Baloo2_800ExtraBold, Figtree_400Regular });
  if (!loaded && !error) return <ActivityIndicator accessibilityLabel="Loading fonts" style={{ flex: 1, backgroundColor: colors.background }} />;
  return <AppProvider><Access><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    {/* The website shows the account and badges as sheets over the current screen. */}
    {['account', 'badges'].map(name => <Stack.Screen key={name} name={name} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />)}
  </Stack></Access><ConfettiHost /><ToastHost /></AppProvider>;
}

