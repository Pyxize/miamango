import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../../src/theme';
import { deleteFolder, Folder, listFolders, listReels, SavedReel } from '../../src/repo';
import { ReelGridCard } from '../../src/components';

const GUTTER = 14;
const H_PADDING = 16;

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

  const confirmDeleteFolder = () => {
    if (isUnfiled || typeof folderId !== 'number') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Supprimer ce dossier ?',
      'Les reels ne seront pas supprimés — ils redeviendront simplement « Non classés ».',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteFolder(folderId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const title = isUnfiled ? 'Non classés' : folder?.name ?? 'Dossier';
  const width = Dimensions.get('window').width;
  const cardWidth = Math.floor((width - H_PADDING * 2 - GUTTER) / 2);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
      </View>
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
                <Pressable
                  onPress={confirmDeleteFolder}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.deleteBtnText}>Supprimer</Text>
                </Pressable>
              ),
        }}
      />
      <View style={styles.container}>
        {reels.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Dossier vide</Text>
            <Text style={styles.emptyBody}>
              {isUnfiled
                ? 'Tous tes reels sont déjà rangés.'
                : 'Assigne des reels à ce dossier depuis leur page de détail.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={reels}
            keyExtractor={(r) => r.id}
            numColumns={2}
            columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: H_PADDING }}
            ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
            contentContainerStyle={{
              paddingTop: 12,
              paddingBottom: 24 + insets.bottom,
            }}
            ListHeaderComponent={
              <View style={styles.header}>
                <Text style={styles.count}>
                  {reels.length} reel{reels.length > 1 ? 's' : ''}
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.ink}
              />
            }
            renderItem={({ item }) => (
              <ReelGridCard
                reel={item}
                width={cardWidth}
                onPress={() =>
                  router.push(
                    isUnfiled
                      ? `/reel/${encodeURIComponent(item.id)}`
                      : `/reel/${encodeURIComponent(item.id)}?from=${folderId}`
                  )
                }
              />
            )}
          />
        )}

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  center: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 12,
  },
  count: {
    color: colors.inkMuted,
    fontFamily: fonts.serifRegular,
    fontSize: 14,
  },
  deleteBtn: {
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerSoft,
  },
  deleteBtnText: {
    color: colors.danger,
    fontFamily: fonts.serifBold,
    fontSize: 13,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 24,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.inkMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
