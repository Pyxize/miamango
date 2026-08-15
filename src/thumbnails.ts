import * as FileSystem from 'expo-file-system/legacy';

const THUMB_DIR = FileSystem.documentDirectory + 'thumbs/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(THUMB_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(THUMB_DIR, { intermediates: true });
  }
}

export async function cacheThumbnail(url: string, id: string): Promise<string | null> {
  try {
    await ensureDir();
    const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[1]?.toLowerCase() ?? 'jpg';
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dest = `${THUMB_DIR}${safeId}.${ext}`;
    const res = await FileSystem.downloadAsync(url, dest);
    if (res.status >= 200 && res.status < 300) return res.uri;
    return null;
  } catch {
    return null;
  }
}

export async function deleteThumbnail(localPath: string | null | undefined) {
  if (!localPath) return;
  try {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  } catch {}
}
