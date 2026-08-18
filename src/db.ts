import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export const DEFAULT_FOLDER_NAME = 'Recette';

let sqlClient: NeonQueryFunction<any, any> | null = null;
let schemaPromise: Promise<void> | null = null;

export function getSql(): NeonQueryFunction<any, any> {
  if (sqlClient) return sqlClient;
  const url = process.env.EXPO_PUBLIC_NEON_URL;
  if (!url || !url.startsWith('postgres')) {
    throw new Error(
      'EXPO_PUBLIC_NEON_URL manquant ou invalide. Colle ta connexion string Neon dans le fichier .env à la racine du projet.'
    );
  }
  sqlClient = neon(url);
  return sqlClient;
}

export async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = initSchema().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function initSchema(): Promise<void> {
  const sql = getSql();

  await sql`CREATE TABLE IF NOT EXISTS reels (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    author TEXT,
    author_handle TEXT,
    title TEXT,
    thumbnail_url TEXT,
    thumbnail_local_path TEXT,
    video_id TEXT,
    created_at BIGINT NOT NULL,
    ingredients JSONB,
    steps JSONB,
    checked_ingredients JSONB
  )`;

  await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS checked_ingredients JSONB`;
  await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS recipe_title TEXT`;
  await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS prep_minutes INT`;
  await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS cook_minutes INT`;
  await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS servings INT`;
  await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS difficulty TEXT`;

  await sql`CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC)`;

  await sql`CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at BIGINT NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS reel_folders (
    reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    PRIMARY KEY (reel_id, folder_id)
  )`;

  await sql`CREATE INDEX IF NOT EXISTS idx_reel_folders_folder ON reel_folders(folder_id)`;

  await sql`INSERT INTO folders (name, color, created_at)
            VALUES (${DEFAULT_FOLDER_NAME}, NULL, ${Date.now()})
            ON CONFLICT (name) DO NOTHING`;
}
