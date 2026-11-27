import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Gate } from '../components/Gate';
import { Shell } from '../components/Shell';
import { colors } from '../lib/format';
import { PortfolioProvider } from '../lib/PortfolioContext';
import { useWide } from '../lib/useLayout';

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.accent },
};

export default function RootLayout() {
  const wide = useWide();
  return (
    <ThemeProvider value={theme}>
      <PortfolioProvider>
        <StatusBar style="dark" />
        <Gate>
          <Shell>
            <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: colors.text }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="stock/[symbol]" options={{ title: '' }} />
              {/* phones: a sheet from the bottom; wide screens: a centred dialog */}
              <Stack.Screen name="order/[symbol]" options={{ presentation: wide ? 'transparentModal' : 'modal', headerShown: false, animation: wide ? 'fade' : undefined }} />
            </Stack>
          </Shell>
        </Gate>
      </PortfolioProvider>
    </ThemeProvider>
  );
}
