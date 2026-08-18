import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform as RNPlatform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../src/theme';
import { fetchReelInfo, ReelInfo } from '../src/scraper';
import {
  addReelToFolder,
  DEFAULT_FOLDER_NAME,
  Folder,
  getOrCreateDefaultFolder,
  insertReel,
  listFolders,
  makeId,
} from '../src/repo';
import { cacheThumbnail } from '../src/thumbnails';
import { parseRecipe, ParsedRecipe, RecipeMetadata } from '../src/recipe';
import { extractTitle, stripEmojis } from '../src/text';
import { FolderChip, PlatformBadge, RecipePill } from '../src/components';

export default function AddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState(params.url ?? '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<ReelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<number>>(new Set());

  const recipe: ParsedRecipe = useMemo(() => parseRecipe(info?.title), [info?.title]);

  useEffect(() => {
    (async () => setFolders(await listFolders()))();
  }, []);

  const analyze = useCallback(async (u: string) => {
    setError(null);
    setInfo(null);
    if (!u.trim()) {
      setError('Colle une URL Instagram Reel ou TikTok.');
      return;
    }
    setLoading(true);
    try {
      const result = await fetchReelInfo(u);
      setInfo(result);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (params.url) analyze(params.url);
  }, [params.url, analyze]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text.trim());
      await analyze(text.trim());
    }
  };

  const toggleFolder = (folderId: number) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!info) return;
    setSaving(true);
    try {
      const id = makeId(info.platform, info.videoId, info.url);
      const localThumb = info.thumbnail
        ? await cacheThumbnail(info.thumbnail, id)
        : null;
      await insertReel({
        id,
        platform: info.platform,
        url: info.url,
        canonicalUrl: info.canonicalUrl,
        author: info.author,
        authorHandle: info.authorHandle,
        title: info.title,
        recipeTitle: recipe.title,
        thumbnailUrl: info.thumbnail,
        thumbnailLocalPath: localThumb,
        videoId: info.videoId,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        metadata: recipe.metadata,
      });

      const targets: number[] = Array.from(selectedFolders);
      if (targets.length === 0) {
        const defaultFolder = await getOrCreateDefaultFolder();
        targets.push(defaultFolder.id);
      }
      for (const folderId of targets) {
        await addReelToFolder(id, folderId);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      const detail = e?.cause?.message ?? e?.stack?.split('\n')[0] ?? '';
      setError(
        `Sauvegarde échouée : ${msg}${detail && detail !== msg ? '\n' + detail : ''}`
      );
    } finally {
      setSaving(false);
    }
  };

  const cleanTitle = info ? recipe.title ?? extractTitle(info.title, info.platform) : null;
  const cleanAuthor = info?.author ? stripEmojis(info.author) : null;
  const metaChips = formatMetadataChips(recipe.metadata);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={RNPlatform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={RNPlatform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 32 + insets.bottom,
          gap: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <StepLabel index={1} label={info ? 'Lien collé' : 'Coller un lien'} done={!!info} />
          <Text style={styles.stepHint}>
            Instagram Reel ou TikTok — presse sur Coller si c'est déjà dans le presse-papier.
          </Text>
        </View>

        <View style={styles.urlWrap}>
          <TextInput
            placeholder="https://…"
            placeholderTextColor={colors.inkFaint}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.urlInput}
          />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={handlePaste}
            style={({ pressed }) => [
              styles.btnSecondary,
              { flex: 1 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.btnSecondaryText}>Coller</Text>
          </Pressable>
          <Pressable
            onPress={() => analyze(url)}
            disabled={loading}
            style={({ pressed }) => [
              styles.btnPrimary,
              { flex: 1 },
              loading && styles.btnDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.paper} />
            ) : (
              <Text style={styles.btnPrimaryText}>Analyser</Text>
            )}
          </Pressable>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && !info && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.ink} size="small" />
            <View style={{ flex: 1 }}>
              <Text style={styles.loadingTitle}>Analyse en cours…</Text>
              <Text style={styles.loadingHint}>
                On récupère la vidéo et on extrait les ingrédients.
              </Text>
            </View>
          </View>
        )}

        {info && (
          <>
            <StepLabel index={2} label="Aperçu" done />

            <View style={styles.previewCard}>
              <View style={styles.previewBadges}>
                <PlatformBadge platform={info.platform} />
                {recipe.detected && <RecipePill />}
              </View>

              {info.thumbnail ? (
                <Image
                  source={{ uri: info.thumbnail }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : null}

              {cleanTitle ? (
                <Text style={styles.previewTitle}>{cleanTitle}</Text>
              ) : null}

              {(cleanAuthor || info.authorHandle) && (
                <Text style={styles.previewAuthor}>
                  {cleanAuthor}
                  {info.authorHandle ? (
                    <Text style={styles.previewHandle}>
                      {cleanAuthor ? ' · ' : ''}@{info.authorHandle}
                    </Text>
                  ) : null}
                </Text>
              )}

              {metaChips.length > 0 && (
                <View style={styles.metaChipsRow}>
                  {metaChips.map((chip) => (
                    <View key={chip} style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{chip}</Text>
                    </View>
                  ))}
                </View>
              )}

              {recipe.ingredients.length > 0 && (
                <View style={styles.previewRecipeBlock}>
                  <Text style={styles.previewRecipeLabel}>
                    Ingrédients ({recipe.ingredients.length})
                  </Text>
                  {recipe.ingredients.slice(0, 5).map((ing, i) => (
                    <Text key={i} style={styles.previewRecipeItem}>
                      • {ing}
                    </Text>
                  ))}
                  {recipe.ingredients.length > 5 && (
                    <Text style={styles.previewRecipeMore}>
                      + {recipe.ingredients.length - 5} autres…
                    </Text>
                  )}
                </View>
              )}

              {recipe.steps.length > 0 && (
                <View style={styles.previewRecipeBlock}>
                  <Text style={styles.previewRecipeLabel}>
                    Étapes ({recipe.steps.length})
                  </Text>
                  <Text style={styles.previewRecipeItem} numberOfLines={3}>
                    {recipe.steps[0]}
                  </Text>
                </View>
              )}

              {!recipe.detected && info.title ? (
                <Text style={styles.previewCaption} numberOfLines={4}>
                  {info.title}
                </Text>
              ) : null}
            </View>

            <StepLabel index={3} label="Ranger dans un dossier" done={selectedFolders.size > 0} />

            <View style={styles.foldersBlock}>
              {folders.length === 0 ? (
                <Text style={styles.muted}>
                  Sera enregistré dans « {DEFAULT_FOLDER_NAME} ».
                </Text>
              ) : (
                <>
                  <View style={styles.chipRow}>
                    {folders.map((f) => (
                      <FolderChip
                        key={f.id}
                        label={f.name}
                        active={selectedFolders.has(f.id)}
                        onPress={() => toggleFolder(f.id)}
                      />
                    ))}
                  </View>
                  {selectedFolders.size === 0 && (
                    <Text style={styles.muted}>
                      Rien sélectionné → enregistré dans « {DEFAULT_FOLDER_NAME} »
                    </Text>
                  )}
                </>
              )}
            </View>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.btnPrimary,
                { paddingVertical: 16 },
                saving && styles.btnDisabled,
                pressed && { opacity: 0.85 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.paper} />
              ) : (
                <Text style={[styles.btnPrimaryText, { fontSize: 16 }]}>
                  Enregistrer le reel
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatMetadataChips(meta: RecipeMetadata): string[] {
  const chips: string[] = [];
  const total = meta.totalMinutes ?? (meta.prepMinutes ?? 0) + (meta.cookMinutes ?? 0);
  if (total > 0) {
    if (total >= 60) {
      const h = Math.floor(total / 60);
      const m = total % 60;
      chips.push(m ? `⏱ ${h} h ${m}` : `⏱ ${h} h`);
    } else {
      chips.push(`⏱ ${total} min`);
    }
  } else if (meta.prepMinutes) {
    chips.push(`⏱ ${meta.prepMinutes} min prep`);
  } else if (meta.cookMinutes) {
    chips.push(`⏱ ${meta.cookMinutes} min cuisson`);
  }
  if (meta.servings) chips.push(`👥 ${meta.servings} pers`);
  if (meta.difficulty) {
    const label = meta.difficulty.charAt(0).toUpperCase() + meta.difficulty.slice(1);
    chips.push(`⭐ ${label}`);
  }
  return chips;
}

function StepLabel({
  index,
  label,
  done,
}: {
  index: number;
  label: string;
  done: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepBubble, done && styles.stepBubbleDone]}>
        {done ? (
          <Text style={styles.stepBubbleCheck}>✓</Text>
        ) : (
          <Text style={styles.stepBubbleNum}>{index}</Text>
        )}
      </View>
      <Text style={styles.stepTitle}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBubbleDone: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  stepBubbleNum: {
    color: colors.inkMuted,
    fontFamily: fonts.serifBold,
    fontSize: 13,
  },
  stepBubbleCheck: {
    color: colors.paper,
    fontFamily: fonts.serifBold,
    fontSize: 13,
  },
  stepTitle: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 18,
  },
  stepHint: {
    color: colors.inkMuted,
    fontSize: 13,
    marginLeft: 36,
  },
  urlWrap: {
    marginTop: -8,
  },
  urlInput: {
    backgroundColor: colors.paperElevated,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.serifRegular,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -8,
  },
  btnPrimary: {
    backgroundColor: colors.ink,
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: colors.paper,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  errorCard: {
    padding: 14,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: colors.paperElevated,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  loadingTitle: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 15,
    marginBottom: 2,
  },
  loadingHint: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  previewCard: {
    backgroundColor: colors.paperElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12,
  },
  previewBadges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 380,
    borderRadius: radii.md,
    backgroundColor: colors.paperSunken,
  },
  previewTitle: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  previewAuthor: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  previewHandle: {
    color: colors.inkMuted,
    fontFamily: fonts.serifRegular,
    fontSize: 13,
  },
  previewRecipeBlock: {
    gap: 4,
    marginTop: 4,
  },
  previewRecipeLabel: {
    color: colors.accent,
    fontFamily: fonts.serifBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  previewRecipeItem: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  previewRecipeMore: {
    color: colors.inkFaint,
    fontSize: 12,
  },
  previewCaption: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  metaChipText: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 12,
  },
  foldersBlock: {
    gap: 8,
    marginTop: -8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muted: {
    color: colors.inkFaint,
    fontSize: 13,
  },
});
