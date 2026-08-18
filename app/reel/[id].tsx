import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform as RNPlatform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  updateReel,
  updateReelChecked,
} from '../../src/repo';
import { deleteThumbnail } from '../../src/thumbnails';
import { extractTitle, profileUrl, stripEmojis } from '../../src/text';
import { FolderChip, PlatformBadge, RecipePill } from '../../src/components';
import { RecipeMetadata, Difficulty } from '../../src/recipe';

type EditDraft = {
  title: string;
  recipeTitle: string;
  ingredients: string[];
  steps: string[];
  prepMinutes: string;
  cookMinutes: string;
  servings: string;
  difficulty: Difficulty | '';
};

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

function toIntOrNull(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const checkedSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (checkedSaveTimer.current) clearTimeout(checkedSaveTimer.current);
    };
  }, []);

  const toggleFolder = async (folderId: number) => {
    if (!decodedId) return;
    if (assignedFolderIds.has(folderId)) {
      await removeReelFromFolder(decodedId, folderId);
    } else {
      await addReelToFolder(decodedId, folderId);
    }
    await load();
  };

  const toggleChecked = (index: number) => {
    if (!reel) return;
    Haptics.selectionAsync();
    const next = [...reel.checkedIngredients];
    while (next.length < reel.ingredients.length) next.push(false);
    next[index] = !next[index];
    setReel({ ...reel, checkedIngredients: next });
    if (checkedSaveTimer.current) clearTimeout(checkedSaveTimer.current);
    checkedSaveTimer.current = setTimeout(() => {
      updateReelChecked(reel.id, next).catch((err) => {
        console.warn('[reel] updateReelChecked failed', err);
      });
    }, 300);
  };

  const beginEdit = () => {
    if (!reel) return;
    Haptics.selectionAsync();
    setDraft({
      title: reel.title ?? '',
      recipeTitle: reel.recipeTitle ?? '',
      ingredients: [...reel.ingredients],
      steps: [...reel.steps],
      prepMinutes: reel.metadata.prepMinutes != null ? String(reel.metadata.prepMinutes) : '',
      cookMinutes: reel.metadata.cookMinutes != null ? String(reel.metadata.cookMinutes) : '',
      servings: reel.metadata.servings != null ? String(reel.metadata.servings) : '',
      difficulty: reel.metadata.difficulty ?? '',
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!reel || !draft) return;
    setSaving(true);
    try {
      const cleanedIngredients = draft.ingredients
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const cleanedSteps = draft.steps
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const prepMinutes = toIntOrNull(draft.prepMinutes);
      const cookMinutes = toIntOrNull(draft.cookMinutes);
      const metadata: RecipeMetadata = {
        prepMinutes,
        cookMinutes,
        totalMinutes:
          prepMinutes != null && cookMinutes != null
            ? prepMinutes + cookMinutes
            : prepMinutes ?? cookMinutes,
        servings: toIntOrNull(draft.servings),
        difficulty: draft.difficulty === '' ? null : draft.difficulty,
      };
      await updateReel(reel.id, {
        title: draft.title.trim() || null,
        recipeTitle: draft.recipeTitle.trim() || null,
        ingredients: cleanedIngredients,
        steps: cleanedSteps,
        metadata,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
      setDraft(null);
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Sauvegarde échouée');
    } finally {
      setSaving(false);
    }
  };

  const updateDraftIngredient = (i: number, value: string) => {
    if (!draft) return;
    const next = [...draft.ingredients];
    next[i] = value;
    setDraft({ ...draft, ingredients: next });
  };

  const removeDraftIngredient = (i: number) => {
    if (!draft) return;
    const next = draft.ingredients.filter((_, idx) => idx !== i);
    setDraft({ ...draft, ingredients: next });
  };

  const addDraftIngredient = () => {
    if (!draft) return;
    setDraft({ ...draft, ingredients: [...draft.ingredients, ''] });
  };

  const updateDraftStep = (i: number, value: string) => {
    if (!draft) return;
    const next = [...draft.steps];
    next[i] = value;
    setDraft({ ...draft, steps: next });
  };

  const removeDraftStep = (i: number) => {
    if (!draft) return;
    const next = draft.steps.filter((_, idx) => idx !== i);
    setDraft({ ...draft, steps: next });
  };

  const addDraftStep = () => {
    if (!draft) return;
    setDraft({ ...draft, steps: [...draft.steps, ''] });
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
  const cleanTitle = reel.recipeTitle ?? extractTitle(reel.title, reel.platform);
  const cleanAuthor = stripEmojis(reel.author);
  const profileHref = profileUrl(reel.platform, reel.authorHandle);
  const metaChips = formatMetadataChips(reel.metadata);

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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={RNPlatform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={RNPlatform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        style={{ backgroundColor: colors.paper }}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
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
          {editing && draft ? (
            <TextInput
              value={draft.recipeTitle}
              onChangeText={(v) => setDraft({ ...draft, recipeTitle: v })}
              placeholder="Titre de la recette"
              placeholderTextColor={colors.inkFaint}
              style={styles.titleInput}
              multiline
            />
          ) : cleanTitle ? (
            <Text style={styles.title}>{cleanTitle}</Text>
          ) : null}

          {!editing && (cleanAuthor || reel.authorHandle) && (
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

          {!editing && metaChips.length > 0 && (
            <View style={styles.metaChipsRow}>
              {metaChips.map((chip) => (
                <View key={chip} style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{chip}</Text>
                </View>
              ))}
            </View>
          )}

          {editing && draft ? (
            <View style={styles.recipeCard}>
              <Text style={styles.recipeLabel}>Infos</Text>
              <View style={styles.metaEditGrid}>
                <View style={styles.metaEditItem}>
                  <Text style={styles.metaEditLabel}>Prép. (min)</Text>
                  <TextInput
                    value={draft.prepMinutes}
                    onChangeText={(v) =>
                      setDraft({ ...draft, prepMinutes: v.replace(/[^0-9]/g, '') })
                    }
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor={colors.inkFaint}
                    style={styles.metaEditInput}
                  />
                </View>
                <View style={styles.metaEditItem}>
                  <Text style={styles.metaEditLabel}>Cuisson (min)</Text>
                  <TextInput
                    value={draft.cookMinutes}
                    onChangeText={(v) =>
                      setDraft({ ...draft, cookMinutes: v.replace(/[^0-9]/g, '') })
                    }
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor={colors.inkFaint}
                    style={styles.metaEditInput}
                  />
                </View>
                <View style={styles.metaEditItem}>
                  <Text style={styles.metaEditLabel}>Portions</Text>
                  <TextInput
                    value={draft.servings}
                    onChangeText={(v) =>
                      setDraft({ ...draft, servings: v.replace(/[^0-9]/g, '') })
                    }
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor={colors.inkFaint}
                    style={styles.metaEditInput}
                  />
                </View>
              </View>
              <Text style={styles.metaEditLabel}>Difficulté</Text>
              <View style={styles.chipRow}>
                {(['facile', 'moyen', 'difficile'] as const).map((d) => {
                  const active = draft.difficulty === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() =>
                        setDraft({ ...draft, difficulty: active ? '' : d })
                      }
                      style={[styles.diffChip, active && styles.diffChipActive]}
                    >
                      <Text
                        style={[
                          styles.diffChipText,
                          active && styles.diffChipTextActive,
                        ]}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {!editing && (
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
          )}

          {editing && draft ? (
            <View style={styles.recipeCard}>
              <Text style={styles.recipeLabel}>Ingrédients</Text>
              <View style={{ gap: 8 }}>
                {draft.ingredients.map((ing, i) => (
                  <View key={i} style={styles.editRow}>
                    <TextInput
                      value={ing}
                      onChangeText={(v) => updateDraftIngredient(i, v)}
                      placeholder="Ingrédient"
                      placeholderTextColor={colors.inkFaint}
                      style={styles.editInput}
                      multiline
                    />
                    <Pressable
                      onPress={() => removeDraftIngredient(i)}
                      hitSlop={8}
                      style={styles.editRemove}
                    >
                      <Text style={styles.editRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable onPress={addDraftIngredient} style={styles.addRowBtn}>
                <Text style={styles.addRowBtnText}>+ Ajouter un ingrédient</Text>
              </Pressable>
            </View>
          ) : (
            reel.ingredients.length > 0 && (
              <View style={styles.recipeCard}>
                <Text style={styles.recipeLabel}>Ingrédients</Text>
                <View style={{ gap: 4 }}>
                  {reel.ingredients.map((ing, i) => {
                    const isChecked = reel.checkedIngredients[i] === true;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => toggleChecked(i)}
                        style={({ pressed }) => [
                          styles.ingredientRow,
                          pressed && { opacity: 0.7 },
                        ]}
                        hitSlop={4}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            isChecked && styles.checkboxChecked,
                          ]}
                        >
                          {isChecked && (
                            <Text style={styles.checkboxTick}>✓</Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.ingredientText,
                            isChecked && styles.ingredientTextChecked,
                          ]}
                        >
                          {stripEmojis(ing)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )
          )}

          {editing && draft ? (
            <View style={styles.recipeCard}>
              <Text style={styles.recipeLabel}>Étapes</Text>
              <View style={{ gap: 8 }}>
                {draft.steps.map((step, i) => (
                  <View key={i} style={styles.editRow}>
                    <View style={styles.stepBadgeSmall}>
                      <Text style={styles.stepBadgeSmallText}>{i + 1}</Text>
                    </View>
                    <TextInput
                      value={step}
                      onChangeText={(v) => updateDraftStep(i, v)}
                      placeholder="Étape"
                      placeholderTextColor={colors.inkFaint}
                      style={[styles.editInput, { minHeight: 60 }]}
                      multiline
                    />
                    <Pressable
                      onPress={() => removeDraftStep(i)}
                      hitSlop={8}
                      style={styles.editRemove}
                    >
                      <Text style={styles.editRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable onPress={addDraftStep} style={styles.addRowBtn}>
                <Text style={styles.addRowBtnText}>+ Ajouter une étape</Text>
              </Pressable>
            </View>
          ) : (
            reel.steps.length > 0 && (
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
            )
          )}

          {!editing && reel.title ? (
            <Pressable onPress={() => setShowRawCaption(!showRawCaption)}>
              <View style={styles.captionToggleRow}>
                <Text style={styles.sectionLabel}>Caption originale</Text>
                <Text style={styles.captionToggle}>
                  {showRawCaption ? 'Masquer' : 'Afficher'}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {!editing && showRawCaption && reel.title ? (
            <Text style={styles.caption}>{stripEmojis(reel.title)}</Text>
          ) : null}

          <View style={styles.actions}>
            {editing ? (
              <>
                <Pressable
                  onPress={saveEdit}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    saving && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.paper} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Enregistrer</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={cancelEdit}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.btnSecondary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.btnSecondaryText}>Annuler</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={beginEdit}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.btnPrimaryText}>Modifier la recette</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(reel.canonicalUrl)}
                  style={({ pressed }) => [
                    styles.btnSecondary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.btnSecondaryText}>Ouvrir dans le navigateur</Text>
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
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  titleInput: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    backgroundColor: colors.paperElevated,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
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
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -4,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperElevated,
  },
  metaChipText: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 12,
  },
  metaEditGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metaEditItem: {
    flex: 1,
    gap: 6,
  },
  metaEditLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.serifBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaEditInput: {
    color: colors.ink,
    fontSize: 15,
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  diffChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  diffChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  diffChipText: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 13,
  },
  diffChipTextActive: {
    color: colors.paper,
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
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxTick: {
    color: colors.paper,
    fontFamily: fonts.serifBold,
    fontSize: 14,
    lineHeight: 16,
  },
  ingredientText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  ingredientTextChecked: {
    color: colors.inkFaint,
    textDecorationLine: 'line-through',
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
  stepBadgeSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  stepBadgeSmallText: {
    color: colors.paper,
    fontFamily: fonts.serifBold,
    fontSize: 12,
  },
  stepText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  editInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
  },
  editRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: colors.paper,
  },
  editRemoveText: {
    color: colors.inkMuted,
    fontSize: 20,
    lineHeight: 22,
    fontFamily: fonts.serifBold,
  },
  addRowBtn: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addRowBtnText: {
    color: colors.accent,
    fontFamily: fonts.serifBold,
    fontSize: 13,
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
});
