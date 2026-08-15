export type Platform = 'tiktok' | 'instagram';

export type ReelInfo = {
  platform: Platform;
  url: string;
  canonicalUrl: string;
  author: string | null;
  authorHandle: string | null;
  authorUrl: string | null;
  title: string | null;
  thumbnail: string | null;
  videoId: string | null;
  raw: Record<string, unknown>;
};

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FB_CRAWLER_UA = 'facebookexternalhit/1.1';

const TIKTOK_HOSTS = ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'];
const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com', 'm.instagram.com'];

export function detectPlatform(url: string): Platform | null {
  try {
    const { hostname } = new URL(url);
    const host = hostname.toLowerCase();
    if (TIKTOK_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return 'tiktok';
    if (INSTAGRAM_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return 'instagram';
    return null;
  } catch {
    return null;
  }
}

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMeta(html: string, key: 'property' | 'name', value: string): string | null {
  const re = new RegExp(
    `<meta\\s+${key}=["']${value}["']\\s+content=["']([^"']+)["']`,
    'i'
  );
  const m = html.match(re) || html.match(
    new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+${key}=["']${value}["']`, 'i')
  );
  return m ? decodeEntities(m[1]) : null;
}

export async function fetchTikTok(url: string): Promise<ReelInfo> {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const res = await fetch(oembedUrl, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`TikTok oEmbed HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, any>;

  const canonicalMatch = typeof data.html === 'string' ? data.html.match(/cite="([^"]+)"/) : null;
  const canonicalUrl = canonicalMatch?.[1] ?? url;

  return {
    platform: 'tiktok',
    url,
    canonicalUrl,
    author: data.author_name ?? null,
    authorHandle: data.author_unique_id ?? null,
    authorUrl: data.author_url ?? null,
    title: data.title ?? null,
    thumbnail: data.thumbnail_url ?? null,
    videoId: data.embed_product_id ?? null,
    raw: data,
  };
}

export async function fetchInstagram(url: string): Promise<ReelInfo> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': FB_CRAWLER_UA,
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`Instagram HTTP ${res.status}`);
  const html = await res.text();

  const ogImage = extractMeta(html, 'property', 'og:image');
  const ogUrl = extractMeta(html, 'property', 'og:url');
  const twitterTitle = extractMeta(html, 'name', 'twitter:title');
  const ogTitle = extractMeta(html, 'property', 'og:title');
  const ogDescription = extractMeta(html, 'property', 'og:description');

  let authorHandle: string | null = null;
  let author: string | null = null;

  const usernameMatch = ogUrl?.match(/instagram\.com\/([^/]+)\/(?:reel|reels|p)\//i);
  if (usernameMatch) authorHandle = usernameMatch[1];

  const titleSrc = twitterTitle || ogTitle;
  if (titleSrc) {
    const nameMatch = titleSrc.match(/^(.+?)\s*\(@([^)]+)\)/);
    if (nameMatch) {
      author = nameMatch[1].trim();
      authorHandle = authorHandle ?? nameMatch[2].trim();
    } else {
      author = titleSrc.trim();
    }
  }

  const shortcodeMatch = url.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
  const videoId = shortcodeMatch?.[1] ?? null;

  return {
    platform: 'instagram',
    url,
    canonicalUrl: ogUrl ?? url,
    author,
    authorHandle,
    authorUrl: authorHandle ? `https://www.instagram.com/${authorHandle}/` : null,
    title: ogDescription ?? null,
    thumbnail: ogImage,
    videoId,
    raw: { ogImage, ogUrl, ogTitle, ogDescription, twitterTitle },
  };
}

export async function fetchReelInfo(url: string): Promise<ReelInfo> {
  const trimmed = url.trim();
  const platform = detectPlatform(trimmed);
  if (!platform) throw new Error('URL non reconnue (attendu : instagram.com ou tiktok.com)');
  if (platform === 'tiktok') return fetchTikTok(trimmed);
  return fetchInstagram(trimmed);
}
