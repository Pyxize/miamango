import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../../src/theme';
import {
  addReelToFolder,
  deleteReel,
  Folder,
  getReel,
  listFolders,
  listFoldersForReel,
  removeReelFromFolder,
  SavedReel,
} from '../../src/repo';
import { deleteThumbnail } from '../../src/thumbnails';
import { extractTitle, profileUrl, stripEmojis } from '../../src/text';
import { FolderChip, PlatformBadge, RecipePill } from '../../src/components';

export default function ReelDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reel, setReel] = useState<SavedReel | null>(null);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [assignedFolderIds, setAssignedFolderIds] = useState<Set<number>>(
    new Set()
  );
  const [showRawCaption, setShowRawCaption] = useState(false);

  const decodedId = id ? decodeURIComponent(id) : null;
  const fromFolderId = from && !isNaN(Number(from)) ? Number(from) : null;
  const fromFolder = fromFolderId
    ? folders.find((f) => f.id === fromFolderId)
    : null;

  const load = useCallback(async () => {
    if (!decodedId) return;
    const [r, allFolders, assigned] = await Promise.all([
      getReel(decodedId),
      listFolders(),
      listFoldersForReel(decodedId),
    ]);
    setReel(r);
    setFolders(allFolders);
    setAssignedFolderIds(new Set(assigned));
    setLoading(false);
  }, [decodedId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFolder = async (folderId: number) => {
    if (!decodedId) return;
    if (assignedFolderIds.has(folderId)) {
      await removeReelFromFolder(decodedId, folderId);
    } else {
      await addReelToFolder(decodedId, folderId);
    }
    await load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (!reel) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Reel introuvable</Text>
      </View>
    );
  }

  const thumb = reel.thumbnailLocalPath ?? reel.thumbnailUrl;
  const hasRecipe = reel.ingredients.length > 0 || reel.steps.length > 0;
  const cleanTitle = extractTitle(reel.title, reel.platform);
  const cleanAuthor = stripEmojis(reel.author);
  const profileHref = profileUrl(reel.platform, reel.authorHandle);

  const confirmDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      fromFolder ? 'Supprimer partout ?' : 'Supprimer ce reel ?',
      "Ce reel sera retiré de tous tes dossiers et définitivement supprimé de ta liste. Le reel original TikTok / Instagram n'est pas affecté.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteThumbnail(reel.thumbnailLocalPath);
            await deleteReel(reel.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const confirmRemoveFromFolder = () => {
    if (!fromFolderId || !fromFolder) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      `Retirer de « ${fromFolder.name} » ?`,
      "Le reel restera dans tes autres dossiers, et dans « Non classés » s'il n'appartient à aucun autre dossier.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            await removeReelFromFolder(reel.id, fromFolderId);
            router.back();
          },
        },
      ]
    );
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(reel.canonicalUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openProfile = () => {
    if (profileHref) Linking.openURL(profileHref);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
    >
      {thumb ? (
        <View style={styles.heroWrap}>
          <Image source={{ uri: thumb }} style={styles.hero} resizeMode="cover" />
          <View style={styles.heroBadges}>
            <PlatformBadge platform={reel.platform} />
            {hasRecipe && <RecipePill />}
          </View>
        </View>
      ) : (
        <View style={[styles.heroWrap, styles.heroFallback]}>
          <View style={styles.heroBadges}>
            <PlatformBadge platform={reel.platform} />
            {hasRecipe && <RecipePill />}
          </View>
        </View>
      )}

      <View style={styles.body}>
        {cleanTitle ? <Text style={styles.title}>{cleanTitle}</Text> : null}

        {(cleanAuthor || reel.authorHandle) && (
          <View style={styles.authorRow}>
            {cleanAuthor ? (
              <Text style={styles.author}>{cleanAuthor}</Text>
            ) : null}
            {reel.authorHandle ? (
              <Pressable onPress={openProfile} hitSlop={6}>
                <Text style={styles.handle}>@{reel.authorHandle} →</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dossiers</Text>
          {folders.length === 0 ? (
            <Text style={styles.muted}>
              Aucun dossier. Crée-en depuis l'écran d'accueil.
            </Text>
          ) : (
            <View style={styles.chipRow}>
              {folders.map((f) => (
                <FolderChip
                  key={f.id}
                  label={f.name}
                  active={assignedFolderIds.has(f.id)}
                  onPress={() => toggleFolder(f.id)}
                />
              ))}
            </View>
          )}
        </View>

        {reel.ingredients.length > 0 && (
          <View style={styles.recipeCard}>
            <Text style={styles.recipeLabel}>Ingrédients</Text>
            <View style={{ gap: 8 }}>
              {reel.ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.ingredientText}>{stripEmojis(ing)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {reel.steps.length > 0 && (
          <View style={styles.recipeCard}>
            <Text style={styles.recipeLabel}>Étapes</Text>
            <View style={{ gap: 14 }}>
              {reel.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{stripEmojis(step)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {reel.title ? (
          <Pressable onPress={() => setShowRawCaption(!showRawCaption)}>
            <View style={styles.captionToggleRow}>
              <Text style={styles.sectionLabel}>Caption originale</Text>
              <Text style={styles.captionToggle}>
                {showRawCaption ? 'Masquer' : 'Afficher'}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {showRawCaption && reel.title ? (
          <Text style={styles.caption}>{stripEmojis(reel.title)}</Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => Linking.openURL(reel.canonicalUrl)}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>Ouvrir dans le navigateur</Text>
          </Pressable>
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.btnSecondaryText}>Copier le lien</Text>
          </Pressable>
          {fromFolder && (
            <Pressable
              onPress={confirmRemoveFromFolder}
              style={({ pressed }) => [
                styles.btnDangerSoft,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.btnDangerSoftText}>
                Retirer de « {fromFolder.name} »
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.btnDangerGhost,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.btnDangerGhostText}>
              {fromFolder ? 'Supprimer partout' : 'Supprimer'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    color: colors.inkMuted,
    fontSize: 15,
  },
  heroWrap: {
    aspectRatio: 4 / 3,
    maxHeight: 420,
    backgroundColor: colors.paperSunken,
    position: 'relative',
  },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroFallback: {
    minHeight: 200,
  },
  heroBadges: {
    position: 'absolute',
    left: 16,
    top: 16,
    flexDirection: 'row',
    gap: 8,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  authorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 8,
  },
  author: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 15,
  },
  handle: {
    color: colors.accent,
    fontFamily: fonts.serifBold,
    fontSize: 15,
  },
  section: {
    gap: 8,
    marginTop: 4,
  },
  sectionLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.serifBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muted: {
    color: colors.inkFaint,
    fontSize: 14,
  },
  recipeCard: {
    backgroundColor: colors.paperElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 14,
  },
  recipeLabel: {
    color: colors.accent,
    fontFamily: fonts.serifBold,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  ingredientText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: colors.paper,
    fontFamily: fonts.serifBold,
    fontSize: 13,
  },
  stepText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  captionToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginTop: 4,
  },
  captionToggle: {
    color: colors.inkMuted,
    fontSize: 13,
    fontFamily: fonts.serifBold,
  },
  caption: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  btnPrimary: {
    backgroundColor: colors.ink,
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: colors.paper,
    fontFamily: fonts.serifBold,
    fontSize: 15,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.paperElevated,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  btnDangerSoft: {
    backgroundColor: colors.dangerSoft,
    paddingVertical: 12,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  btnDangerSoftText: {
    color: colors.danger,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  btnDangerGhost: {
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 12,
    borderRadius: radii.pill,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  btnDangerGhostText: {
    color: colors.danger,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  canonical: {
    color: colors.inkFaint,
    fontSize: 11,
    marginTop: 8,
  },
});
