import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors } from '../lib/format';

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const Label = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => (
  <Text style={[styles.label, style]}>{children}</Text>
);

export const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <View style={styles.stat}>
    <Label>{label}</Label>
    <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
  </View>
);

export const Chip = ({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && { color: colors.bg }]}>{label}</Text>
  </Pressable>
);

export const Banner = ({ text }: { text: string }) => (
  <View style={styles.banner}>
    <Text style={styles.bannerText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  stat: { flexBasis: '50%', paddingVertical: 8 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '600' },
  banner: { backgroundColor: '#3A2A08', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.accent },
  bannerText: { color: colors.accent, fontSize: 13 },
});
