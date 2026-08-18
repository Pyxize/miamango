export type Platform = 'tiktok' | 'instagram';

export type ReelInfo = {
  platform: Platform;
  url: string;
  canonicalUrl: string;

  author: string | null;
  authorHandle: string | null;
  authorUrl: string | null;

  title: string | null;
  description: string | null;

  thumbnail: string | null;
  videoId: string | null;

  raw?: Record<string, unknown>;
};

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  'm.tiktok.com',
]);

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
]);

const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/120.0.0.0 Safari/537.36';

const FACEBOOK_CRAWLER_UA = 'facebookexternalhit/1.1';

/**
 * Détecte la plateforme depuis l'URL.
 */
export function detectPlatform(url: string): Platform | null {
  try {
    const { hostname } = new URL(url);
    const host = hostname.toLowerCase();

    if (
        TIKTOK_HOSTS.has(host) ||
        host.endsWith('.tiktok.com')
    ) {
      return 'tiktok';
    }

    if (
        INSTAGRAM_HOSTS.has(host) ||
        host.endsWith('.instagram.com')
    ) {
      return 'instagram';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extrait une meta tag sans dépendre de l'ordre des attributs.
 *
 * Supporte :
 * <meta property="og:image" content="...">
 * <meta content="..." property="og:image">
 */
function extractMeta(
    html: string,
    attribute: 'property' | 'name',
    value: string,
): string | null {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const tagRegex = /<meta\b[^>]*>/gi;
  const tags = html.match(tagRegex);

  if (!tags) return null;

  for (const tag of tags) {
    const attributeRegex = new RegExp(
        `${attribute}\\s*=\\s*["']${escapedValue}["']`,
        'i',
    );

    if (!attributeRegex.test(tag)) continue;

    const contentMatch = tag.match(
        /content\s*=\s*["']([^"']*)["']/i,
    );

    if (contentMatch?.[1]) {
      return decodeHtmlEntities(contentMatch[1]);
    }
  }

  return null;
}

/**
 * Décodage basique des HTML entities présentes dans les meta tags.
 */
function decodeHtmlEntities(value: string): string {
  return value
      .replace(/&#(\d+);/g, (_, code) =>
          String.fromCharCode(Number(code)),
      )
      .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
          String.fromCharCode(parseInt(code, 16)),
      )
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
}

/**
 * Extrait le shortcode Instagram.
 */
function extractInstagramId(url: string): string | null {
  const match = url.match(
      /\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i,
  );

  return match?.[1] ?? null;
}

/**
 * Extrait le handle depuis une URL Instagram.
 */
function extractInstagramHandle(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;

    const match = pathname.match(
        /^\/([^/]+)\/(?:reel|reels|p)\//i,
    );

    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * TikTok
 *
 * API officielle oEmbed.
 */
export async function fetchTikTok(
    url: string,
): Promise<ReelInfo> {
  const endpoint =
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': BROWSER_UA,
    },
  });

  if (!response.ok) {
    throw new Error(
        `TikTok oEmbed HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as Record<
      string,
      unknown
  >;

  const html =
      typeof data.html === 'string'
          ? data.html
          : null;

  const canonicalUrl =
      html?.match(/cite=["']([^"']+)["']/i)?.[1] ??
      url;

  return {
    platform: 'tiktok',
    url,
    canonicalUrl,

    author:
        typeof data.author_name === 'string'
            ? data.author_name
            : null,

    authorHandle:
        typeof data.author_unique_id === 'string'
            ? data.author_unique_id
            : null,

    authorUrl:
        typeof data.author_url === 'string'
            ? data.author_url
            : null,

    title:
        typeof data.title === 'string'
            ? data.title
            : null,

    description:
        typeof data.title === 'string'
            ? data.title
            : null,

    thumbnail:
        typeof data.thumbnail_url === 'string'
            ? data.thumbnail_url
            : null,

    videoId:
        typeof data.embed_product_id === 'string'
            ? data.embed_product_id
            : null,

    raw: data,
  };
}

/**
 * Instagram
 *
 * Récupération des Open Graph metadata.
 */
/**
 * Extrait la légende depuis un texte au format Instagram OG :
 *   'Author on Instagram: "…caption…"'
 *   'N likes, N comments - handle on date: "…caption…"'
 * Retourne le contenu entre guillemets, ou null si aucun pattern reconnu.
 * Supporte guillemets droits, typographiques et « » français.
 */
function extractInstagramCaption(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/[:\-–—]\s*["“”«»](.+)["“”«»]\s*\.?\s*$/s);
  if (match) return match[1].trim();
  const openIdx = raw.search(/["“”«»]/);
  if (openIdx >= 0) {
    const rest = raw.slice(openIdx + 1);
    const closeIdx = rest.search(/["“”«»](?=\s*\.?\s*$)/);
    if (closeIdx > 0) return rest.slice(0, closeIdx).trim();
  }
  return null;
}

export async function fetchInstagram(
    url: string,
): Promise<ReelInfo> {
  const response = await fetch(url, {
    headers: {
      Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',

      'User-Agent': FACEBOOK_CRAWLER_UA,
    },
  });

  if (!response.ok) {
    throw new Error(
        `Instagram HTTP ${response.status}`,
    );
  }

  const html = await response.text();

  const ogTitle = extractMeta(
      html,
      'property',
      'og:title',
  );

  const ogDescription = extractMeta(
      html,
      'property',
      'og:description',
  );

  const ogImage = extractMeta(
      html,
      'property',
      'og:image',
  );

  const ogUrl = extractMeta(
      html,
      'property',
      'og:url',
  );

  const twitterTitle = extractMeta(
      html,
      'name',
      'twitter:title',
  );

  if (__DEV__) {
    console.log('[scraper.instagram] meta', {
      ogTitleLen: ogTitle?.length ?? 0,
      ogDescriptionLen: ogDescription?.length ?? 0,
      twitterTitle,
    });
  }

  const canonicalUrl =
      ogUrl ?? url;

  const videoId =
      extractInstagramId(canonicalUrl) ??
      extractInstagramId(url);

  let authorHandle =
      extractInstagramHandle(canonicalUrl) ??
      extractInstagramHandle(url);

  let author: string | null = null;

  /**
   * twitterTitle : ""
   *   → auteur + handle uniquement, PAS la légende.
   * ogTitle : 'Author on Instagram: "…caption…"'
   *   → contient la vraie légende.
   * ogDescription : 'N likes, N comments - handle on date: "…caption…"'
   *   → contient la légende aussi, avec un préfixe stats.
   *
   * On veut :
   *   - `author` = nom d'affichage (Twitter title est le plus propre)
   *   - `title`  = la légende brute (ce que parseRecipe attend)
   */
  if (twitterTitle) {
    const authorMatch = twitterTitle.match(
        /^(.+?)\s*\(@([^)]+)\)/,
    );
    if (authorMatch) {
      author = authorMatch[1].trim();
      authorHandle =
          authorHandle ??
          authorMatch[2].trim();
    }
  }

  const caption =
      extractInstagramCaption(ogTitle) ??
      extractInstagramCaption(ogDescription) ??
      ogDescription ??
      ogTitle ??
      twitterTitle ??
      null;

  const title = caption;

  if (!author && ogTitle) {
    const ogAuthorMatch = ogTitle.match(
        /^(.+?)\s+on\s+Instagram/i,
    );
    if (ogAuthorMatch) author = ogAuthorMatch[1].trim();
  }

  return {
    platform: 'instagram',
    url,
    canonicalUrl,

    author,
    authorHandle,

    authorUrl: authorHandle
        ? `https://www.instagram.com/${authorHandle}/`
        : null,

    title,
    description: ogDescription,

    thumbnail: ogImage,

    videoId,

    raw: {
      ogTitle,
      ogDescription,
      ogImage,
      ogUrl,
      twitterTitle,
    },
  };
}

/**
 * Fonction principale.
 */
export async function fetchReelInfo(
    url: string,
): Promise<ReelInfo> {
  const normalizedUrl = url.trim();

  if (__DEV__) console.log('[scraper] fetchReelInfo', normalizedUrl);

  if (!normalizedUrl) {
    throw new Error('URL vide');
  }

  const platform =
      detectPlatform(normalizedUrl);

  if (!platform) {
    throw new Error(
        'URL non reconnue. Instagram et TikTok uniquement.',
    );
  }

  switch (platform) {
    case 'tiktok':
      return fetchTikTok(normalizedUrl);

    case 'instagram':
      return fetchInstagram(normalizedUrl);
  }
}
