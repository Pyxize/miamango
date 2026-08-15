import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@gluestack-ui/themed';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, shadow } from '../src/theme';
import {
  createFolder,
  Folder,
  listFolders,
  listReels,
  SavedReel,
} from '../src/repo';
import { ReelCard, ReelRow } from '../src/components';

const CARD_WIDTH = 148;
const CARD_THUMB_HEIGHT = 208;

type FolderSectionData = { folder: Folder; reels: SavedReel[] };

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
        setUnclassifiedReels(unclassified.slice(0, 6));

        const sections = await Promise.all(
          folders.map(async (f) => ({
            folder: f,
            reels: (await listReels({ folderId: f.id })).slice(0, 6),
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
  const showEmpty =
    !searchResults && !hasFolders && unclassifiedReels.length === 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Mes reels' }} />
      <View style={styles.container}>
        <View style={styles.searchWrap}>
          <TextInput
            placeholder="Rechercher un auteur, un ingrédient…"
            placeholderTextColor={colors.inkFaint}
            value={search}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
        </View>

        {errorMsg && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {searchResults ? (
          <FlatList
            data={searchResults}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <ReelRow
                reel={item}
                onPress={() =>
                  router.push(`/reel/${encodeURIComponent(item.id)}`)
                }
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 120 + insets.bottom,
              paddingTop: 4,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.ink}
              />
            }
            ListEmptyComponent={
              <Text style={styles.searchEmpty}>
                Aucun résultat pour “{search}”
              </Text>
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.ink}
              />
            }
          >
            {showEmpty && <EmptyState />}

            {unclassifiedReels.length > 0 && (
              <FolderSectionRow
                title="Non classés"
                count={unclassifiedReels.length}
                accent={colors.inkMuted}
                reels={unclassifiedReels}
                onSeeAll={() => router.push('/folder/unfiled')}
                onCardPress={(id) =>
                  router.push(`/reel/${encodeURIComponent(id)}`)
                }
              />
            )}

            {folderSections.map(({ folder, reels }, i) => (
              <FolderSectionRow
                key={folder.id}
                title={folder.name}
                count={folder.count}
                accent={sectionAccent(i)}
                reels={reels}
                onSeeAll={() => router.push(`/folder/${folder.id}`)}
                onCardPress={(id) =>
                  router.push(`/reel/${encodeURIComponent(id)}`)
                }
              />
            ))}

            <Pressable
              onPress={openCreateFolder}
              style={({ pressed }) => [
                styles.newFolderCard,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.newFolderPlus}>+</Text>
              <Text style={styles.newFolderText}>Nouveau dossier</Text>
            </Pressable>
          </ScrollView>
        )}

        <Pressable
          onPress={() => router.push('/add')}
          hitSlop={12}
          style={({ pressed }) => [
            styles.fab,
            { bottom: 24 + insets.bottom },
            pressed && styles.fabPressed,
          ]}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        <Modal isOpen={newFolderOpen} onClose={() => setNewFolderOpen(false)}>
          <ModalBackdrop />
          <ModalContent bg={colors.paperElevated} borderRadius={radii.xl}>
            <ModalHeader>
              <Text style={styles.modalTitle}>Nouveau dossier</Text>
            </ModalHeader>
            <ModalBody>
              <TextInput
                placeholder="Ex : Desserts, Petits-déj…"
                placeholderTextColor={colors.inkFaint}
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                onSubmitEditing={confirmCreateFolder}
                returnKeyType="done"
                style={styles.modalInput}
              />
            </ModalBody>
            <ModalFooter>
              <Pressable
                onPress={() => setNewFolderOpen(false)}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </Pressable>
              <View style={{ width: 10 }} />
              <Pressable
                onPress={confirmCreateFolder}
                disabled={!newFolderName.trim()}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  !newFolderName.trim() && styles.btnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>Créer</Text>
              </Pressable>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </View>
    </>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyBadge}>
        <Text style={styles.emptyBadgeText}>Nouveau</Text>
      </View>
      <Text style={styles.emptyTitle}>Ta bibliothèque de reels</Text>
      <Text style={styles.emptyBody}>
        Ajoute ton premier reel avec le bouton{'  '}
        <Text style={styles.emptyPlus}>+</Text>
        {'  '}puis crée des dossiers pour ranger tes recettes préférées.
      </Text>
    </View>
  );
}

function FolderSectionRow({
  title,
  count,
  accent,
  reels,
  onSeeAll,
  onCardPress,
}: {
  title: string;
  count: number;
  accent: string;
  reels: SavedReel[];
  onSeeAll: () => void;
  onCardPress: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onSeeAll}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={[styles.sectionCount, { backgroundColor: accent }]}>
              <Text style={styles.sectionCountText}>{count}</Text>
            </View>
          </View>
          <Text style={styles.seeAll}>Voir tout →</Text>
        </View>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
      >
        {reels.map((r) => (
          <ReelCard
            key={r.id}
            reel={r}
            onPress={() => onCardPress(r.id)}
            width={CARD_WIDTH}
            thumbHeight={CARD_THUMB_HEIGHT}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const ACCENTS = [
  colors.accent,
  colors.amber,
  colors.sage,
  colors.instagram,
  '#7C58B6',
  '#3E7BA0',
];

function sectionAccent(index: number) {
  return ACCENTS[index % ACCENTS.length];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3D2E13',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  fabText: {
    color: colors.paper,
    fontSize: 32,
    fontFamily: fonts.serifBold,
    lineHeight: 34,
    marginTop: -3,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchInput: {
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.serifRegular,
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  searchEmpty: {
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 48,
    fontSize: 14,
  },
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 22,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  sectionCount: {
    minWidth: 26,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    color: colors.paper,
    fontFamily: fonts.serifBold,
    fontSize: 12,
  },
  seeAll: {
    color: colors.inkMuted,
    fontSize: 13,
    fontFamily: fonts.serifRegular,
  },
  newFolderCard: {
    marginTop: 32,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: radii.xl,
    backgroundColor: colors.paperElevated,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  newFolderPlus: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    color: colors.ink,
    lineHeight: 30,
  },
  newFolderText: {
    fontFamily: fonts.serifBold,
    fontSize: 15,
    color: colors.ink,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 48,
    gap: 12,
  },
  emptyBadge: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  emptyBadgeText: {
    color: colors.accent,
    fontFamily: fonts.serifBold,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  emptyTitle: {
    fontFamily: fonts.serifBold,
    color: colors.ink,
    fontSize: 26,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyBody: {
    color: colors.inkMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyPlus: {
    fontFamily: fonts.serifBold,
    color: colors.ink,
  },
  modalTitle: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 20,
  },
  modalInput: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.serifRegular,
  },
  btnPrimary: {
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  btnPrimaryText: {
    color: colors.paper,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
  },
  btnSecondaryText: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.4,
  },
});

// keep shadow import referenced so it's tree-shaken but present for future use
void shadow;
