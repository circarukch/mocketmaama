import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { Wordmark } from '../../components/ui';
import { colors } from '../../lib/format';
import { useWide } from '../../lib/useLayout';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) => {
  const TabIcon = ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
};

export default function TabsLayout() {
  const wide = useWide();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        // wide screens navigate with the top bar instead (components/Shell.tsx)
        tabBarStyle: wide ? { display: 'none' } : { borderTopColor: colors.border },
        headerShown: !wide,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Watchlist', headerTitle: () => <Wordmark />, tabBarIcon: icon('bookmark-outline') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('receipt-outline') }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio', tabBarIcon: icon('briefcase-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
