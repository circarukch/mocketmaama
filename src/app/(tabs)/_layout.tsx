import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { colors } from '../../lib/format';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) => {
  const TabIcon = ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted }}>
      <Tabs.Screen name="index" options={{ title: 'Markets', tabBarIcon: icon('trending-up') }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio', tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('book') }} />
    </Tabs>
  );
}
