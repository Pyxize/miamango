import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme';
import type { SavedReel } from '../repo';
import { extractTitle, stripEmojis } from '../text';
import { ReelThumb } from './ReelThumb';
import { PlatformBadge, RecipePill } from './Badges';

export function ReelCard({
  reel,
  onPress,
  width = 148,
  thumbHeight = 208,
}: {
  reel: SavedReel;
  onPress: () => void;
  width?: number;
  thumbHeight?: number;
}) {
  const thumb = reel.thumbnailLocalPath ?? reel.thumbnailUrl;
  const title = extractTitle(reel.title, reel.platform);
  const hasRecipe = reel.ingredients.length > 0 || reel.steps.length > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ position: 'relative' }}>
        <ReelThumb uri={thumb} width={width} height={thumbHeight} radius={radii.lg} />
        {hasRecipe && (
          <View style={styles.recipeOverlay}>
            <RecipePill size="sm" />
          </View>
        )}
      </View>
      <View style={styles.meta}>
        {title ? (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : (
          <Text style={styles.titleFallback} numberOfLines={1}>
            {reel.authorHandle ? `@${reel.authorHandle}` : reel.platform}
          </Text>
        )}
        {reel.author ? (
          <Text style={styles.author} numberOfLines={1}>
            {stripEmojis(reel.author)}
          </Text>
        ) : reel.authorHandle ? (
          <Text style={styles.author} numberOfLines={1}>
            @{reel.authorHandle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ReelGridCard({
  reel,
  onPress,
  width,
}: {
  reel: SavedReel;
  onPress: () => void;
  width: number;
}) {
  const thumb = reel.thumbnailLocalPath ?? reel.thumbnailUrl;
  const title = extractTitle(reel.title, reel.platform);
  const hasRecipe = reel.ingredients.length > 0 || reel.steps.length > 0;
  const thumbHeight = Math.round(width * (16 / 11));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ position: 'relative' }}>
        <ReelThumb uri={thumb} width={width} height={thumbHeight} radius={radii.lg} />
        <View style={styles.topRow}>
          <PlatformBadge platform={reel.platform} size="sm" />
          {hasRecipe && <RecipePill size="sm" />}
        </View>
      </View>
      <View style={styles.meta}>
        {title ? (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {reel.author ? (
          <Text style={styles.author} numberOfLines={1}>
            {stripEmojis(reel.author)}
          </Text>
        ) : reel.authorHandle ? (
          <Text style={styles.author} numberOfLines={1}>
            @{reel.authorHandle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ReelRow({ reel, onPress }: { reel: SavedReel; onPress: () => void }) {
  const thumb = reel.thumbnailLocalPath ?? reel.thumbnailUrl;
  const title = extractTitle(reel.title, reel.platform);
  const hasRecipe = reel.ingredients.length > 0 || reel.steps.length > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <ReelThumb uri={thumb} width={84} height={116} radius={radii.md} />
      <View style={styles.rowMeta}>
        <View style={styles.rowBadges}>
          <PlatformBadge platform={reel.platform} size="sm" />
          {hasRecipe && <RecipePill size="sm" />}
        </View>
        {reel.author ? (
          <Text style={styles.rowAuthor} numberOfLines={1}>
            {stripEmojis(reel.author)}
            {reel.authorHandle ? (
              <Text style={styles.rowHandle}> · @{reel.authorHandle}</Text>
            ) : null}
          </Text>
        ) : reel.authorHandle ? (
          <Text style={styles.rowAuthor} numberOfLines={1}>
            @{reel.authorHandle}
          </Text>
        ) : null}
        {title ? (
          <Text style={styles.rowTitle} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  meta: {
    marginTop: 10,
    gap: 2,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 15,
    lineHeight: 19,
  },
  titleFallback: {
    color: colors.inkMuted,
    fontFamily: fonts.serifRegular,
    fontSize: 14,
  },
  author: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  topRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  recipeOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.paperElevated,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowMeta: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  rowBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  rowAuthor: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  rowHandle: {
    color: colors.inkMuted,
    fontFamily: fonts.serifRegular,
    fontSize: 13,
  },
  rowTitle: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 17,
  },
});
