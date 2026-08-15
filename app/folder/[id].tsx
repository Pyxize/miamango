import {
  Box,
  HStack,
  VStack,
  Text,
  Heading,
  Pressable,
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
  Button,
  ButtonText,
} from '../../src/ui';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listReels, SavedReel, deleteFolder, listFolders, Folder } from '../../src/repo';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isUnfiled = id === 'unfiled';
  const folderId = isUnfiled ? null : id ? parseInt(id, 10) : NaN;

  const [reels, setReels] = useState<SavedReel[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listReels({ folderId });
      setReels(rows);
      if (!isUnfiled && typeof folderId === 'number') {
        const folders = await listFolders();
        setFolder(folders.find((f) => f.id === folderId) ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [folderId, isUnfiled]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDeleteFolder = async () => {
    if (isUnfiled || typeof folderId !== 'number') return;
    await deleteFolder(folderId);
    setConfirmOpen(false);
    router.back();
  };

  const title = isUnfiled ? 'Non classés' : folder?.name ?? 'Dossier';

  if (loading) {
    return (
      <Box flex={1} bg="$black" justifyContent="center" alignItems="center">
        <Spinner color="$white" />
      </Box>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: isUnfiled
            ? undefined
            : () => (
                <Pressable onPress={() => setConfirmOpen(true)}>
                  <Text color="#fecaca" fontSize="$sm">Supprimer</Text>
                </Pressable>
              ),
        }}
      />
      <Box flex={1} bg="$black">
        {reels.length === 0 ? (
          <VStack flex={1} justifyContent="center" alignItems="center" gap="$2" px="$8">
            <Heading color="#fff" size="lg">Dossier vide</Heading>
            <Text color="#a1a1aa" textAlign="center">
              {isUnfiled
                ? 'Tous tes reels sont déjà rangés.'
                : 'Assigne des reels à ce dossier depuis leur page de détail.'}
            </Text>
          </VStack>
        ) : (
          <FlatList
            data={reels}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <ReelRow
                reel={item}
                onPress={() =>
                  router.push(
                    isUnfiled
                      ? `/reel/${encodeURIComponent(item.id)}`
                      : `/reel/${encodeURIComponent(item.id)}?from=${folderId}`
                  )
                }
              />
            )}
            ItemSeparatorComponent={() => <Box h="$3" />}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 24 + insets.bottom,
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          />
        )}

        <AlertDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <AlertDialogBackdrop />
          <AlertDialogContent bg="#17171d">
            <AlertDialogHeader>
              <Heading color="#fff" size="md">Supprimer ce dossier ?</Heading>
            </AlertDialogHeader>
            <AlertDialogBody>
              <Text color="#a1a1aa">
                Les reels de ce dossier ne seront pas supprimés — ils redeviendront simplement "Non classés".
              </Text>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button variant="outline" borderColor="#3f3f46" mr="$2" onPress={() => setConfirmOpen(false)}>
                <ButtonText color="#fff">Annuler</ButtonText>
              </Button>
              <Button action="negative" bg="#7f1d1d" onPress={handleDeleteFolder}>
                <ButtonText color="#fff">Supprimer</ButtonText>
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Box>
    </>
  );
}

function ReelRow({ reel, onPress }: { reel: SavedReel; onPress: () => void }) {
  const thumb = reel.thumbnailLocalPath ?? reel.thumbnailUrl;
  const hasRecipe = reel.ingredients.length > 0 || reel.steps.length > 0;
  return (
    <Pressable onPress={onPress}>
      <HStack bg="#17171d" borderRadius="$xl" p="$3" gap="$3" borderWidth={1} borderColor="#27272e">
        {thumb ? (
          <Image source={{ uri: thumb }} alt="thumb" w={72} h={100} borderRadius="$md" bg="#0b0b0f" />
        ) : (
          <Box w={72} h={100} borderRadius="$md" bg="#0b0b0f" />
        )}
        <VStack flex={1} gap="$1">
          <HStack gap="$2" alignItems="center">
            <Badge size="sm" action={reel.platform === 'tiktok' ? 'muted' : 'error'} variant="solid">
              <BadgeText>{reel.platform.toUpperCase()}</BadgeText>
            </Badge>
            {hasRecipe && (
              <Badge size="sm" action="success" variant="solid">
                <BadgeText>🍳</BadgeText>
              </Badge>
            )}
          </HStack>
          {reel.author && (
            <Text color="#fff" fontWeight="$semibold" numberOfLines={1}>
              {reel.author}
              {reel.authorHandle ? <Text color="#a1a1aa"> @{reel.authorHandle}</Text> : null}
            </Text>
          )}
          {hasRecipe ? (
            <Text color="#d4d4d8" numberOfLines={2} fontSize="$sm">
              {reel.ingredients.length} ingrédient{reel.ingredients.length > 1 ? 's' : ''}
              {reel.steps.length > 0 ? ` · ${reel.steps.length} étape${reel.steps.length > 1 ? 's' : ''}` : ''}
            </Text>
          ) : reel.title ? (
            <Text color="#d4d4d8" numberOfLines={2} fontSize="$sm">
              {reel.title}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    </Pressable>
  );
}
