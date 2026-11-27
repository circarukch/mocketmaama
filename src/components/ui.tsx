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
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
  </View>
);

export const Chip = ({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && { color: colors.accent }]}>{label}</Text>
  </Pressable>
);

export const Banner = ({ text }: { text: string }) => (
  <View style={styles.banner}>
    <Text style={styles.bannerText}>{text}</Text>
  </View>
);

export const Button = ({ title, onPress, color = colors.accent, disabled, outline }: { title: string; onPress: () => void; color?: string; disabled?: boolean; outline?: boolean }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [styles.btn, outline ? { borderWidth: 1, borderColor: color } : { backgroundColor: color }, (pressed || disabled) && { opacity: 0.6 }]}
  >
    <Text style={[styles.btnText, outline && { color }]}>{title}</Text>
  </Pressable>
);

/** Mocket Maama wordmark */
export const Wordmark = ({ size = 18 }: { size?: number }) => (
  <Text style={{ fontSize: size, fontWeight: '800', color: colors.text, letterSpacing: -0.3 }}>
    Mocket <Text style={{ color: colors.brand }}>Maama</Text>
  </Text>
);

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 8, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  stat: { flexBasis: '50%', paddingVertical: 8 },
  statLabel: { color: colors.muted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  chipActive: { borderColor: colors.accent, backgroundColor: '#EEF3FF' },
  chipText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  banner: { backgroundColor: colors.warnBg, borderRadius: 6, padding: 10 },
  bannerText: { color: colors.warnText, fontSize: 12 },
  btn: { height: 48, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
});
