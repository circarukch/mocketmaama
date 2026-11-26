import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../lib/format';
import { PortfolioProvider } from '../lib/PortfolioContext';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, primary: colors.accent },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <PortfolioProvider>
        <StatusBar style="light" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="stock/[symbol]" options={{ title: '' }} />
        </Stack>
      </PortfolioProvider>
    </ThemeProvider>
  );
}
