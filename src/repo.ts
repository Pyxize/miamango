import { getSql, ensureSchema, DEFAULT_FOLDER_NAME } from './db';
import { Platform } from './scraper';

export { DEFAULT_FOLDER_NAME };

export type SavedReel = {
  id: string;
  platform: Platform;
  url: string;
  canonicalUrl: string;
  author: string | null;
  authorHandle: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  thumbnailLocalPath: string | null;
  videoId: string | null;
  createdAt: number;
  ingredients: string[];
  steps: string[];
};

export type Folder = {
  id: number;
  name: string;
  color: string | null;
  createdAt: number;
  count: number;
};

function asRows(result: unknown): any[] {
  return (result ?? []) as any[];
}

function coerceStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
    } catch {}
  }
  return [];
}

function toNumber(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') return Number(v);
  return 0;
}

function rowToReel(row: any): SavedReel {
  return {
    id: row.id,
    platform: row.platform as Platform,
    url: row.url,
    canonicalUrl: row.canonical_url,
    author: row.author,
    authorHandle: row.author_handle,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    thumbnailLocalPath: row.thumbnail_local_path,
    videoId: row.video_id,
    createdAt: toNumber(row.created_at),
    ingredients: coerceStringArray(row.ingredients),
    steps: coerceStringArray(row.steps),
  };
}

export function makeId(platform: Platform, videoId: string | null, url: string): string {
  return `${platform}:${videoId ?? url}`;
}

export type InsertReelInput = Omit<SavedReel, 'createdAt'> & { createdAt?: number };

export async function insertReel(reel: InsertReelInput): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  const createdAt = reel.createdAt ?? Date.now();
  const ingredients = JSON.stringify(reel.ingredients ?? []);
  const steps = JSON.stringify(reel.steps ?? []);

  await sql`
    INSERT INTO reels (
      id, platform, url, canonical_url, author, author_handle, title,
      thumbnail_url, thumbnail_local_path, video_id, created_at,
      ingredients, steps
    ) VALUES (
      ${reel.id}, ${reel.platform}, ${reel.url}, ${reel.canonicalUrl},
      ${reel.author ?? null}, ${reel.authorHandle ?? null}, ${reel.title ?? null},
      ${reel.thumbnailUrl ?? null}, ${reel.thumbnailLocalPath ?? null}, ${reel.videoId ?? null},
      ${createdAt},
      ${ingredients}::jsonb,
      ${steps}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      url = EXCLUDED.url,
      canonical_url = EXCLUDED.canonical_url,
      author = EXCLUDED.author,
      author_handle = EXCLUDED.author_handle,
      title = EXCLUDED.title,
      thumbnail_url = EXCLUDED.thumbnail_url,
      thumbnail_local_path = EXCLUDED.thumbnail_local_path,
      video_id = EXCLUDED.video_id,
      ingredients = EXCLUDED.ingredients,
      steps = EXCLUDED.steps
  `;
}

export type ListFilter = {
  search?: string;
  folderId?: number | null;
};

export async function listReels(filter: ListFilter = {}): Promise<SavedReel[]> {
  await ensureSchema();
  const sql = getSql();
  const q = filter.search?.trim() ? `%${filter.search.trim()}%` : null;
  const folderId = filter.folderId;

  let raw: unknown;
  if (folderId === null) {
    raw = q
      ? await sql`
          SELECT r.* FROM reels r
          LEFT JOIN reel_folders rf ON rf.reel_id = r.id
          WHERE rf.folder_id IS NULL
            AND (r.author ILIKE ${q} OR r.author_handle ILIKE ${q}
                 OR r.title ILIKE ${q} OR r.ingredients::text ILIKE ${q}
                 OR r.steps::text ILIKE ${q})
          ORDER BY r.created_at DESC`
      : await sql`
          SELECT r.* FROM reels r
          LEFT JOIN reel_folders rf ON rf.reel_id = r.id
          WHERE rf.folder_id IS NULL
          ORDER BY r.created_at DESC`;
  } else if (typeof folderId === 'number') {
    raw = q
      ? await sql`
          SELECT r.* FROM reels r
          JOIN reel_folders rf ON rf.reel_id = r.id
          WHERE rf.folder_id = ${folderId}
            AND (r.author ILIKE ${q} OR r.author_handle ILIKE ${q}
                 OR r.title ILIKE ${q} OR r.ingredients::text ILIKE ${q}
                 OR r.steps::text ILIKE ${q})
          ORDER BY r.created_at DESC`
      : await sql`
          SELECT r.* FROM reels r
          JOIN reel_folders rf ON rf.reel_id = r.id
          WHERE rf.folder_id = ${folderId}
          ORDER BY r.created_at DESC`;
  } else {
    raw = q
      ? await sql`
          SELECT * FROM reels
          WHERE author ILIKE ${q} OR author_handle ILIKE ${q}
             OR title ILIKE ${q} OR ingredients::text ILIKE ${q}
             OR steps::text ILIKE ${q}
          ORDER BY created_at DESC`
      : await sql`SELECT * FROM reels ORDER BY created_at DESC`;
  }

  return asRows(raw).map(rowToReel);
}

export async function getReel(id: string): Promise<SavedReel | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = asRows(await sql`SELECT * FROM reels WHERE id = ${id} LIMIT 1`);
  return rows[0] ? rowToReel(rows[0]) : null;
}

export async function deleteReel(id: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM reels WHERE id = ${id}`;
}

export async function countReels(): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = asRows(await sql`SELECT COUNT(*)::int AS n FROM reels`);
  return rows[0]?.n ?? 0;
}

export async function listFolders(): Promise<Folder[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = asRows(await sql`
    SELECT f.id, f.name, f.color, f.created_at,
           (SELECT COUNT(*)::int FROM reel_folders rf WHERE rf.folder_id = f.id) AS count
    FROM folders f
    ORDER BY f.name COLLATE "C"
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    createdAt: toNumber(r.created_at),
    count: r.count ?? 0,
  }));
}

export async function createFolder(name: string, color?: string): Promise<Folder> {
  await ensureSchema();
  const sql = getSql();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Le nom du dossier est requis');
  const now = Date.now();
  const rows = asRows(await sql`
    INSERT INTO folders (name, color, created_at)
    VALUES (${trimmed}, ${color ?? null}, ${now})
    RETURNING id
  `);
  return {
    id: rows[0].id,
    name: trimmed,
    color: color ?? null,
    createdAt: now,
    count: 0,
  };
}

export async function deleteFolder(id: number): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM folders WHERE id = ${id}`;
}

export async function addReelToFolder(reelId: string, folderId: number): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO reel_folders (reel_id, folder_id)
    VALUES (${reelId}, ${folderId})
    ON CONFLICT DO NOTHING
  `;
}

export async function removeReelFromFolder(reelId: string, folderId: number): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM reel_folders WHERE reel_id = ${reelId} AND folder_id = ${folderId}`;
}

export async function listFoldersForReel(reelId: string): Promise<number[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = asRows(await sql`SELECT folder_id FROM reel_folders WHERE reel_id = ${reelId}`);
  return rows.map((r) => r.folder_id);
}

export async function getOrCreateDefaultFolder(): Promise<Folder> {
  await ensureSchema();
  const sql = getSql();
  const rows = asRows(await sql`
    SELECT f.id, f.name, f.color, f.created_at,
           (SELECT COUNT(*)::int FROM reel_folders rf WHERE rf.folder_id = f.id) AS count
    FROM folders f WHERE f.name = ${DEFAULT_FOLDER_NAME} LIMIT 1
  `);
  if (rows[0]) {
    return {
      id: rows[0].id,
      name: rows[0].name,
      color: rows[0].color,
      createdAt: toNumber(rows[0].created_at),
      count: rows[0].count ?? 0,
    };
  }
  return createFolder(DEFAULT_FOLDER_NAME);
}
