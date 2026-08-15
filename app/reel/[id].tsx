import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Image,
  Badge,
  BadgeText,
  Spinner,
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Heading,
  Pressable,
} from '../../src/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  getReel,
  deleteReel,
  SavedReel,
  listFolders,
  Folder,
  listFoldersForReel,
  addReelToFolder,
  removeReelFromFolder,
} from '../../src/repo';
import { deleteThumbnail } from '../../src/thumbnails';
import { extractTitle, stripEmojis, profileUrl } from '../../src/text';

export default function ReelDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reel, setReel] = useState<SavedReel | null>(null);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [assignedFolderIds, setAssignedFolderIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeFromFolderOpen, setRemoveFromFolderOpen] = useState(false);
  const [showRawCaption, setShowRawCaption] = useState(false);

  const decodedId = id ? decodeURIComponent(id) : null;
  const fromFolderId = from && !isNaN(Number(from)) ? Number(from) : null;
  const fromFolder = fromFolderId ? folders.find((f) => f.id === fromFolderId) : null;

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
      <Box flex={1} bg="$black" justifyContent="center" alignItems="center">
        <Spinner color="$white" />
      </Box>
    );
  }

  if (!reel) {
    return (
      <Box flex={1} bg="$black" justifyContent="center" alignItems="center">
        <Text color="#a1a1aa">Reel introuvable</Text>
      </Box>
    );
  }

  const thumb = reel.thumbnailLocalPath ?? reel.thumbnailUrl;
  const hasRecipe = reel.ingredients.length > 0 || reel.steps.length > 0;
  const cleanTitle = extractTitle(reel.title, reel.platform);
  const cleanAuthor = stripEmojis(reel.author);
  const profileHref = profileUrl(reel.platform, reel.authorHandle);

  const handleDelete = async () => {
    await deleteThumbnail(reel.thumbnailLocalPath);
    await deleteReel(reel.id);
    setConfirmOpen(false);
    router.back();
  };

  const handleRemoveFromCurrentFolder = async () => {
    if (!fromFolderId) return;
    await removeReelFromFolder(reel.id, fromFolderId);
    setRemoveFromFolderOpen(false);
    router.back();
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(reel.canonicalUrl);
  };

  const openProfile = () => {
    if (profileHref) Linking.openURL(profileHref);
  };

  return (
    <ScrollView
      style={{ backgroundColor: '#0b0b0f' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
    >
      <VStack gap="$3">
        <HStack justifyContent="space-between" alignItems="center">
          <Badge action={reel.platform === 'tiktok' ? 'muted' : 'error'} variant="solid">
            <BadgeText>{reel.platform.toUpperCase()}</BadgeText>
          </Badge>
          {hasRecipe && (
            <Badge action="success" variant="solid">
              <BadgeText>🍳 RECETTE</BadgeText>
            </Badge>
          )}
        </HStack>

        {thumb && (
          <Image
            source={{ uri: thumb }}
            alt="thumbnail"
            w="100%"
            aspectRatio={9 / 16}
            maxHeight={420}
            borderRadius="$md"
            bg="#17171d"
          />
        )}

        {cleanTitle && (
          <Heading color="#fff" size="lg">
            {cleanTitle}
          </Heading>
        )}

        {(cleanAuthor || reel.authorHandle) && (
          <HStack alignItems="baseline" flexWrap="wrap" gap="$2">
            {cleanAuthor ? (
              <Text color="#d4d4d8" fontSize="$md" fontWeight="$semibold">{cleanAuthor}</Text>
            ) : null}
            {reel.authorHandle && (
              <Pressable onPress={openProfile}>
                <Text color="#a5b4fc" fontSize="$md">@{reel.authorHandle} →</Text>
              </Pressable>
            )}
          </HStack>
        )}

        <VStack gap="$2" mt="$2">
          <Text color="#a1a1aa" fontSize="$xs" letterSpacing={1}>DOSSIERS</Text>
          {folders.length === 0 ? (
            <Text color="#71717a" fontSize="$sm">
              Aucun dossier. Crée-en depuis l'écran d'accueil.
            </Text>
          ) : (
            <HStack flexWrap="wrap" gap="$2">
              {folders.map((f) => {
                const active = assignedFolderIds.has(f.id);
                return (
                  <Pressable key={f.id} onPress={() => toggleFolder(f.id)}>
                    <Box
                      bg={active ? '#6366f1' : '#17171d'}
                      borderColor={active ? '#6366f1' : '#27272e'}
                      borderWidth={1}
                      borderRadius="$full"
                      px="$3"
                      py="$2"
                    >
                      <Text color={active ? '#fff' : '#d4d4d8'} fontSize="$sm" fontWeight="$semibold">
                        {active ? '✓ ' : ''}{f.name}
                      </Text>
                    </Box>
                  </Pressable>
                );
              })}
            </HStack>
          )}
        </VStack>

        {reel.ingredients.length > 0 && (
          <VStack gap="$2" mt="$3" bg="#17171d" p="$3" borderRadius="$xl" borderWidth={1} borderColor="#27272e">
            <Text color="#a5b4fc" fontSize="$xs" letterSpacing={1} fontWeight="$bold">
              INGRÉDIENTS
            </Text>
            {reel.ingredients.map((ing, i) => (
              <HStack key={i} gap="$2" alignItems="flex-start">
                <Text color="#6366f1" fontSize="$sm">•</Text>
                <Text color="#fafafa" fontSize="$sm" flex={1}>{stripEmojis(ing)}</Text>
              </HStack>
            ))}
          </VStack>
        )}

        {reel.steps.length > 0 && (
          <VStack gap="$3" mt="$2" bg="#17171d" p="$3" borderRadius="$xl" borderWidth={1} borderColor="#27272e">
            <Text color="#a5b4fc" fontSize="$xs" letterSpacing={1} fontWeight="$bold">
              ÉTAPES
            </Text>
            {reel.steps.map((step, i) => (
              <HStack key={i} gap="$3" alignItems="flex-start">
                <Box bg="#6366f1" borderRadius="$full" w={22} h={22} justifyContent="center" alignItems="center">
                  <Text color="#fff" fontSize="$xs" fontWeight="$bold">{i + 1}</Text>
                </Box>
                <Text color="#fafafa" fontSize="$sm" flex={1} lineHeight={22}>{stripEmojis(step)}</Text>
              </HStack>
            ))}
          </VStack>
        )}

        {reel.title && (
          <Pressable onPress={() => setShowRawCaption(!showRawCaption)}>
            <HStack justifyContent="space-between" alignItems="center" mt="$2" py="$2">
              <Text color="#71717a" fontSize="$xs" letterSpacing={1}>
                CAPTION ORIGINALE
              </Text>
              <Text color="#71717a" fontSize="$xs">
                {showRawCaption ? 'Masquer' : 'Afficher'}
              </Text>
            </HStack>
          </Pressable>
        )}

        {showRawCaption && reel.title && (
          <Text color="#a1a1aa" fontSize="$xs" lineHeight={18}>
            {stripEmojis(reel.title)}
          </Text>
        )}

        <VStack gap="$2" mt="$3">
          <Button bg="#6366f1" onPress={() => Linking.openURL(reel.canonicalUrl)}>
            <ButtonText color="#fff">Ouvrir dans le navigateur</ButtonText>
          </Button>
          <Button variant="outline" borderColor="#3f3f46" onPress={handleCopy}>
            <ButtonText color="#fff">Copier le lien</ButtonText>
          </Button>
          {fromFolder && (
            <Button action="negative" bg="#7f1d1d" onPress={() => setRemoveFromFolderOpen(true)}>
              <ButtonText color="#fff">Retirer de "{fromFolder.name}"</ButtonText>
            </Button>
          )}
          <Button
            action="negative"
            variant="outline"
            borderColor="#7f1d1d"
            onPress={() => setConfirmOpen(true)}
          >
            <ButtonText color="#fecaca">
              {fromFolder ? 'Supprimer partout' : 'Supprimer'}
            </ButtonText>
          </Button>
        </VStack>

        <Text color="#52525b" fontSize="$xs" mt="$1">{reel.canonicalUrl}</Text>
      </VStack>

      <AlertDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent bg="#17171d">
          <AlertDialogHeader>
            <Heading color="#fff" size="md">Supprimer partout ?</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text color="#a1a1aa">
              Ce reel sera retiré de tous tes dossiers et définitivement supprimé de ta liste.
              Le reel original TikTok / Instagram n'est pas affecté.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" borderColor="#3f3f46" mr="$2" onPress={() => setConfirmOpen(false)}>
              <ButtonText color="#fff">Annuler</ButtonText>
            </Button>
            <Button action="negative" bg="#7f1d1d" onPress={handleDelete}>
              <ButtonText color="#fff">Supprimer partout</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog isOpen={removeFromFolderOpen} onClose={() => setRemoveFromFolderOpen(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent bg="#17171d">
          <AlertDialogHeader>
            <Heading color="#fff" size="md">
              Retirer de "{fromFolder?.name}" ?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text color="#a1a1aa">
              Le reel restera dans tes autres dossiers et dans "Non classés" s'il n'appartient à
              aucun autre dossier.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              variant="outline"
              borderColor="#3f3f46"
              mr="$2"
              onPress={() => setRemoveFromFolderOpen(false)}
            >
              <ButtonText color="#fff">Annuler</ButtonText>
            </Button>
            <Button action="negative" bg="#7f1d1d" onPress={handleRemoveFromCurrentFolder}>
              <ButtonText color="#fff">Retirer</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollView>
  );
}
