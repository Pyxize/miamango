const EMOJI_RE = new RegExp(
  '(?:' +
    // Grapheme clusters: base emoji + optional modifiers/joiners/tags
    // Base ranges — explicit blocks (independent of Hermes Unicode table version)
    '(?:' +
      '[\\u{1F000}-\\u{1FFFF}]' +           // All Supplemental Multilingual Plane emoji blocks
      '|[\\u{2600}-\\u{27BF}]' +             // Misc Symbols + Dingbats
      '|[\\u{2300}-\\u{23FF}]' +             // Misc Technical
      '|[\\u{2B00}-\\u{2BFF}]' +             // Misc Symbols and Arrows
      '|[\\u{2100}-\\u{214F}]' +             // Letterlike Symbols
      '|[\\u{2000}-\\u{206F}]' +             // General Punctuation (invisibles/joiners)
      '|[\\u{3000}-\\u{303F}]' +             // CJK Symbols
      '|[\\u{3297}\\u{3299}]' +               // Circled ideographs
      '|\\p{Extended_Pictographic}' +        // Property-based catch-all (older engines)
    ')' +
    // Followed by any number of: variation selectors, skin tones, ZWJ + another base, keycap combiner, tag chars
    '(?:' +
      '[\\u{FE00}-\\u{FE0F}]' +
      '|[\\u{1F3FB}-\\u{1F3FF}]' +
      '|\\u{20E3}' +
      '|[\\u{E0020}-\\u{E007F}]' +
      '|\\u{200D}[\\u{1F000}-\\u{1FFFF}\\u{2600}-\\u{27BF}\\u{2300}-\\u{23FF}]' +
    ')*' +
  ')',
  'gu'
);

// Anything left over after emoji stripping: lone surrogates, variation selectors, ZWJ, invisibles
const ORPHAN_RE = /[\u{FE00}-\u{FE0F}\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2060}-\u{206F}\u{FEFF}\u{200D}\u{20E3}\uD800-\uDFFF\u{FFFC}\u{FFFD}]/gu;

export function stripEmojis(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(EMOJI_RE, '')
    .replace(ORPHAN_RE, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractTitle(
  caption: string | null | undefined,
  platform: 'tiktok' | 'instagram' = 'tiktok'
): string | null {
  if (!caption) return null;
  let candidate = caption;

  if (platform === 'instagram') {
    const stripPrefix = candidate.match(/(?:likes?|j'aime|comments?|commentaires?).*?:\s*(.+)$/is);
    if (stripPrefix) candidate = stripPrefix[1];
    candidate = candidate.replace(/^["'“”«»‘’]+|["'“”«»‘’]+$/g, '');
  }

  candidate = stripEmojis(candidate);
  candidate = candidate.split(/\n/)[0].trim();

  const firstSentence = candidate.match(/^([^.!?\n]{1,120})/);
  if (firstSentence) candidate = firstSentence[1].trim();

  return candidate || null;
}

export function profileUrl(
  platform: 'tiktok' | 'instagram',
  handle: string | null | undefined
): string | null {
  if (!handle) return null;
  const clean = handle.replace(/^@/, '').trim();
  if (!clean) return null;
  return platform === 'tiktok'
    ? `https://www.tiktok.com/@${clean}`
    : `https://www.instagram.com/${clean}/`;
}
