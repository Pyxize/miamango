import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, fonts } from '../theme';
import type { Platform } from '../scraper';

export function PlatformBadge({ platform, size = 'md' }: { platform: Platform; size?: 'sm' | 'md' }) {
  const bg = platform === 'instagram' ? colors.instagram : colors.tiktok;
  const label = platform === 'instagram' ? 'Instagram' : 'TikTok';
  return (
    <View style={[styles.badge, size === 'sm' && styles.badgeSm, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, size === 'sm' && styles.badgeTextSm]}>{label}</Text>
    </View>
  );
}

export function RecipePill({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <View style={[styles.pill, size === 'sm' && styles.pillSm]}>
      <Text style={[styles.pillText, size === 'sm' && styles.pillTextSm]}>Recette</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: fonts.serifBold,
    letterSpacing: 0.3,
  },
  badgeTextSm: {
    fontSize: 10,
  },
  pill: {
    backgroundColor: colors.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.amber,
  },
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    color: '#8A5A0F',
    fontSize: 12,
    fontFamily: fonts.serifBold,
    letterSpacing: 0.3,
  },
  pillTextSm: {
    fontSize: 10,
  },
});
