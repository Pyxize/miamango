import {
  Box,
  HStack,
  VStack,
  Text,
  Heading,
  Pressable,
  Image,
  Input,
  InputField,
  Badge,
  BadgeText,
  Button,
  ButtonText,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '../src/ui';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listReels, SavedReel, listFolders, Folder, createFolder } from '../src/repo';
import { extractTitle, stripEmojis } from '../src/text';

const CARD_WIDTH = 130;
const CARD_THUMB_HEIGHT = 180;

type FolderSectionData = {
  folder: Folder;
  reels: SavedReel[];
};

export default function ListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [folderSections, setFolderSections] = useState<FolderSectionData[]>([]);
  const [unclassifiedReels, setUnclassifiedReels] = useState<SavedReel[]>([]);
  const [searchResults, setSearchResults] = useState<SavedReel[] | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(
    async (nextSearch = search) => {
      try {
        setErrorMsg(null);
        if (nextSearch.trim()) {
          const results = await listReels({ search: nextSearch });
          setSearchResults(results);
          return;
        }
        setSearchResults(null);
        const [folders, unclassified] = await Promise.all([
          listFolders(),
          listReels({ folderId: null }),
        ]);
        setUnclassifiedReels(unclassified.slice(0, 4));

        const sections = await Promise.all(
          folders.map(async (f) => ({
            folder: f,
            reels: (await listReels({ folderId: f.id })).slice(0, 4),
          }))
        );
        setFolderSections(sections);
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Erreur de chargement');
      }
    },
    [search]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSearchChange = (value: string) => {
    setSearch(value);
    load(value);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreateFolder = () => {
    setNewFolderName('');
    setNewFolderOpen(true);
  };

  const confirmCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolder(name);
      setNewFolderOpen(false);
      setNewFolderName('');
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de créer le dossier');
    }
  };

  const hasFolders = folderSections.length > 0;
  const showEmpty = !searchResults && !hasFolders && unclassifiedReels.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mes reels',
          headerRight: () => (
            <Pressable onPress={() => router.push('/add')} hitSlop={16}>
              <Box mr="$3" w={32} h={32} borderRadius="$full" bg="#6366f1" alignItems="center" justifyContent="center">
                <Text color="#fff" fontSize={20} fontWeight="$bold" lineHeight={22}>+</Text>
              </Box>
            </Pressable>
          ),
        }}
      />
      <Box flex={1} bg="$black">
      <Box px="$4" pt="$3">
        <Input variant="outline" bg="#17171d" borderColor="#27272e" mb="$3">
          <InputField
            placeholder="Rechercher un auteur, un ingrédient…"
            placeholderTextColor="#71717a"
            color="#fff"
            value={search}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Input>
      </Box>

      {errorMsg && (
        <Box mx="$4" mb="$3" p="$3" bg="#3f1d1d" borderColor="#7f1d1d" borderWidth={1} borderRadius="$md">
          <Text color="#fecaca" fontSize="$xs">{errorMsg}</Text>
        </Box>
      )}

      {searchResults ? (
        <FlatList
          data={searchResults}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <SearchRow reel={item} onPress={() => router.push(`/reel/${encodeURIComponent(item.id)}`)} />
          )}
          ItemSeparatorComponent={() => <Box h="$3" />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ListEmptyComponent={
            <Text color="#71717a" textAlign="center" mt="$8">
              Aucun résultat pour "{search}"
            </Text>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        >
          {showEmpty && (
            <VStack alignItems="center" px="$8" mt="$16" gap="$3">
              <Heading color="#fff" size="lg">Aucun reel</Heading>
              <Text color="#a1a1aa" textAlign="center">
                Ajoute ton premier reel avec le bouton +, puis crée des dossiers pour classer tes recettes.
              </Text>
            </VStack>
          )}

          {unclassifiedReels.length > 0 && (
            <FolderSectionRow
              title="Non classés"
              count={unclassifiedReels.length}
              reels={unclassifiedReels}
              onSeeAll={() => router.push('/folder/unfiled')}
              onCardPress={(id) => router.push(`/reel/${encodeURIComponent(id)}`)}
            />
          )}

          {folderSections.map(({ folder, reels }) => (
            <FolderSectionRow
              key={folder.id}
              title={folder.name}
              count={folder.count}
              reels={reels}
              onSeeAll={() => router.push(`/folder/${folder.id}`)}
              onCardPress={(id) => router.push(`/reel/${encodeURIComponent(id)}`)}
            />
          ))}

          <Box px="$4" mt="$4">
            <Button variant="outline" borderColor="#3f3f46" onPress={openCreateFolder}>
              <ButtonText color="#a5b4fc">+ Nouveau dossier</ButtonText>
            </Button>
          </Box>
        </ScrollView>
      )}

      <Modal isOpen={newFolderOpen} onClose={() => setNewFolderOpen(false)}>
        <ModalBackdrop />
        <ModalContent bg="#17171d">
          <ModalHeader>
            <Heading color="#fff" size="md">Nouveau dossier</Heading>
          </ModalHeader>
          <ModalBody>
            <Input variant="outline" bg="#0b0b0f" borderColor="#27272e">
              <InputField
                placeholder="Ex : Desserts, Petits-déj…"
                placeholderTextColor="#71717a"
                color="#fff"
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                onSubmitEditing={confirmCreateFolder}
                returnKeyType="done"
              />
            </Input>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" borderColor="#3f3f46" mr="$2" onPress={() => setNewFolderOpen(false)}>
              <ButtonText color="#fff">Annuler</ButtonText>
            </Button>
            <Button bg="#6366f1" onPress={confirmCreateFolder} isDisabled={!newFolderName.trim()}>
              <ButtonText color="#fff">Créer</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      </Box>
    </>
  );
}

function FolderSectionRow({
  title,
  count,
  reels,
  onSeeAll,
  onCardPress,
}: {
  title: string;
  count: number;
  reels: SavedReel[];
  onSeeAll: () => void;
  onCardPress: (id: string) => void;
}) {
  return (
    <VStack mt="$5">
      <Pressable onPress={onSeeAll}>
        <HStack justifyContent="space-between" alignItems="center" px="$4" mb="$2">
          <HStack alignItems="baseline" gap="$2">
            <Heading color="#fff" size="md">{title}</Heading>
            <Text color="#71717a" fontSize="$sm">{count}</Text>
          </HStack>
          <Text color="#a5b4fc" fontSize="$sm">Voir tout →</Text>
        </HStack>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {reels.map((r) => (
          <ReelCard key={r.id} reel={r} onPress={() => onCardPress(r.id)} />
        ))}
      </ScrollView>
    </VStack>
  );
}

function ReelCard({ reel, onPress }: { reel: SavedReel; onPress: () => void }) {
  const thumb = reel.thumbnailLocalPath ?? reel.thumbnailUrl;
  const title = extractTitle(reel.title, reel.platform);
  return (
    <Pressable onPress={onPress}>
      <VStack w={CARD_WIDTH} gap="$1">
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            alt="thumb"
            w={CARD_WIDTH}
            h={CARD_THUMB_HEIGHT}
            borderRadius="$md"
            bg="#0b0b0f"
          />
        ) : (
          <Box w={CARD_WIDTH} h={CARD_THUMB_HEIGHT} borderRadius="$md" bg="#17171d" />
        )}
        {title && (
          <Text color="#fafafa" fontSize="$xs" numberOfLines={2} lineHeight={16}>
            {title}
          </Text>
        )}
        {reel.authorHandle && (
          <Text color="#a1a1aa" fontSize="$xs" numberOfLines={1}>
            @{reel.authorHandle}
          </Text>
        )}
      </VStack>
    </Pressable>
  );
}

function SearchRow({ reel, onPress }: { reel: SavedReel; onPress: () => void }) {
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
              {stripEmojis(reel.author)}
              {reel.authorHandle ? <Text color="#a1a1aa"> @{reel.authorHandle}</Text> : null}
            </Text>
          )}
          {reel.title && (
            <Text color="#d4d4d8" numberOfLines={2} fontSize="$sm">
              {extractTitle(reel.title, reel.platform) ?? stripEmojis(reel.title)}
            </Text>
          )}
        </VStack>
      </HStack>
    </Pressable>
  );
}
