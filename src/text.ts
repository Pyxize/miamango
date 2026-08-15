const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2100}-\u{214F}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

const INVISIBLE_RE = /[\u{200B}\u{200C}\u{200E}\u{200F}\u{FEFF}\u{2060}-\u{206F}]/gu;

export function stripEmojis(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(EMOJI_RE, '')
    .replace(INVISIBLE_RE, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
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
