import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Input,
  InputField,
  Image,
  Spinner,
  Alert,
  AlertText,
  Badge,
  BadgeText,
  Pressable,
} from '../src/ui';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchReelInfo, ReelInfo } from '../src/scraper';
import {
  insertReel,
  makeId,
  listFolders,
  Folder,
  addReelToFolder,
  getOrCreateDefaultFolder,
  DEFAULT_FOLDER_NAME,
} from '../src/repo';
import { cacheThumbnail } from '../src/thumbnails';
import { parseRecipe, ParsedRecipe } from '../src/recipe';
import { extractTitle, stripEmojis } from '../src/text';

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
    (async () => {
      const list = await listFolders();
      setFolders(list);
    })();
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
      const localThumb = info.thumbnail ? await cacheThumbnail(info.thumbnail, id) : null;
      await insertReel({
        id,
        platform: info.platform,
        url: info.url,
        canonicalUrl: info.canonicalUrl,
        author: info.author,
        authorHandle: info.authorHandle,
        title: info.title,
        thumbnailUrl: info.thumbnail,
        thumbnailLocalPath: localThumb,
        videoId: info.videoId,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
      });

      const targets: number[] = Array.from(selectedFolders);
      if (targets.length === 0) {
        const defaultFolder = await getOrCreateDefaultFolder();
        targets.push(defaultFolder.id);
      }
      for (const folderId of targets) {
        await addReelToFolder(id, folderId);
      }

      router.back();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      const detail = e?.cause?.message ?? e?.stack?.split('\n')[0] ?? '';
      console.error('[save] failed:', e);
      setError(`Sauvegarde échouée : ${msg}${detail && detail !== msg ? '\n' + detail : ''}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0b0b0f' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text color="#a1a1aa">Colle une URL Instagram Reel ou TikTok</Text>

        <Input variant="outline" bg="#17171d" borderColor="#27272e">
          <InputField
            placeholder="https://…"
            placeholderTextColor="#71717a"
            color="#fff"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Input>

        <HStack gap="$2">
          <Button variant="outline" borderColor="#3f3f46" flex={1} onPress={handlePaste}>
            <ButtonText color="#fff">Coller</ButtonText>
          </Button>
          <Button bg="#6366f1" flex={1} onPress={() => analyze(url)} isDisabled={loading}>
            {loading ? <Spinner color="$white" /> : <ButtonText color="#fff">Analyser</ButtonText>}
          </Button>
        </HStack>

        {error && (
          <Alert action="error" variant="solid" bg="#3f1d1d" borderColor="#7f1d1d" borderWidth={1}>
            <AlertText color="#fecaca">{error}</AlertText>
          </Alert>
        )}

        {info && (
          <VStack bg="#17171d" borderRadius="$xl" p="$3" gap="$3" borderWidth={1} borderColor="#27272e">
            <HStack justifyContent="space-between" alignItems="center">
              <Badge action={info.platform === 'tiktok' ? 'muted' : 'error'} variant="solid">
                <BadgeText>{info.platform.toUpperCase()}</BadgeText>
              </Badge>
              {recipe.detected && (
                <Badge action="success" variant="solid">
                  <BadgeText>RECETTE DÉTECTÉE</BadgeText>
                </Badge>
              )}
            </HStack>

            {info.thumbnail && (
              <Image
                source={{ uri: info.thumbnail }}
                alt="thumbnail"
                w="100%"
                aspectRatio={9 / 16}
                maxHeight={360}
                borderRadius="$md"
                bg="#0b0b0f"
              />
            )}

            {(() => {
              const cleanTitle = extractTitle(info.title, info.platform);
              return cleanTitle ? (
                <Text color="#fff" fontSize="$md" fontWeight="$bold">
                  {cleanTitle}
                </Text>
              ) : null;
            })()}

            {info.author && (
              <Text color="#d4d4d8" fontSize="$sm" fontWeight="$semibold">
                {stripEmojis(info.author)}
                {info.authorHandle ? <Text color="#a1a1aa"> @{info.authorHandle}</Text> : null}
              </Text>
            )}

            {recipe.ingredients.length > 0 && (
              <VStack gap="$1">
                <Text color="#a1a1aa" fontSize="$xs" letterSpacing={1}>
                  INGRÉDIENTS ({recipe.ingredients.length})
                </Text>
                {recipe.ingredients.slice(0, 5).map((ing, i) => (
                  <Text key={i} color="#d4d4d8" fontSize="$sm">• {ing}</Text>
                ))}
                {recipe.ingredients.length > 5 && (
                  <Text color="#71717a" fontSize="$xs">+ {recipe.ingredients.length - 5} autres…</Text>
                )}
              </VStack>
            )}

            {recipe.steps.length > 0 && (
              <VStack gap="$1">
                <Text color="#a1a1aa" fontSize="$xs" letterSpacing={1}>
                  ÉTAPES ({recipe.steps.length})
                </Text>
                <Text color="#d4d4d8" fontSize="$sm" numberOfLines={3}>
                  {recipe.steps[0]}
                </Text>
              </VStack>
            )}

            {!recipe.detected && info.title && (
              <Text color="#d4d4d8" fontSize="$sm" numberOfLines={4}>
                {info.title}
              </Text>
            )}

            <VStack gap="$2" mt="$2">
              <Text color="#a1a1aa" fontSize="$xs" letterSpacing={1}>DOSSIERS</Text>
              {folders.length === 0 ? (
                <Text color="#71717a" fontSize="$xs">
                  Sera enregistré dans "{DEFAULT_FOLDER_NAME}".
                </Text>
              ) : (
                <>
                  <HStack flexWrap="wrap" gap="$2">
                    {folders.map((f) => {
                      const active = selectedFolders.has(f.id);
                      return (
                        <Pressable key={f.id} onPress={() => toggleFolder(f.id)}>
                          <Box
                            bg={active ? '#6366f1' : '#0b0b0f'}
                            borderColor={active ? '#6366f1' : '#3f3f46'}
                            borderWidth={1}
                            borderRadius="$full"
                            px="$3"
                            py="$2"
                          >
                            <Text
                              color={active ? '#fff' : '#d4d4d8'}
                              fontSize="$sm"
                              fontWeight="$semibold"
                            >
                              {active ? '✓ ' : ''}{f.name}
                            </Text>
                          </Box>
                        </Pressable>
                      );
                    })}
                  </HStack>
                  {selectedFolders.size === 0 && (
                    <Text color="#71717a" fontSize="$xs">
                      Rien sélectionné → enregistré dans "{DEFAULT_FOLDER_NAME}"
                    </Text>
                  )}
                </>
              )}
            </VStack>

            <Button bg="#6366f1" onPress={handleSave} isDisabled={saving}>
              {saving ? <Spinner color="$white" /> : <ButtonText color="#fff">Enregistrer</ButtonText>}
            </Button>
          </VStack>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
