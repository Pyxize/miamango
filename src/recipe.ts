import { parseIngredient, type ParseIngredientOptions, type Ingredient } from 'parse-ingredient';
import { CUP_ML, FLOZ_ML, TBSP_ML, TSP_ML, lookupDensity } from './densities';

export type Difficulty = 'facile' | 'moyen' | 'difficile';

export type RecipeMetadata = {
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  servings: number | null;
  difficulty: Difficulty | null;
};

export type ParsedRecipe = {
  title: string | null;
  ingredients: string[];
  steps: string[];
  metadata: RecipeMetadata;
  remainingNotes: string;
  detected: boolean;
};

export const EMPTY_METADATA: RecipeMetadata = {
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  servings: null,
  difficulty: null,
};

const PARSE_OPTS: ParseIngredientOptions = {
  decimalSeparator: ',',
  rangeSeparators: ['to', 'or', 'à'],
  descriptionStripPrefixes: [
    'of',
    /d[eu]?['\s]/iu,
    /de\s+l['ae]?\s+/iu,
    /de\s+la\s+/iu,
    /des\s+/iu,
  ],
  groupHeaderPatterns: ['For', 'Pour', 'Pour le', 'Pour la', 'Pour les'],
  trailingQuantityContext: ['from', 'of', 'de'],
};

const EMOJI_LEADING_RE =
  /^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}]|\s)+/u;

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

function normalizeFractions(s: string): string {
  return s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (m) => ` ${UNICODE_FRACTIONS[m] ?? m} `);
}

function normalizeFrenchUnits(s: string): string {
  return s
    .replace(/\bc\.?\s*à\.?\s*s\.?\b/gi, 'tbsp')
    .replace(/\bc\.?\s*à\.?\s*c\.?\b/gi, 'tsp')
    .replace(/\bcuill(?:[eè]re)?s?\s+à\s+soupe\b/gi, 'tbsp')
    .replace(/\bcuill(?:[eè]re)?s?\s+à\s+caf[eé]\b/gi, 'tsp');
}

function formatQuantity(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

const VOLUME_UNIT_ML: Record<string, number> = {
  cup: CUP_ML,
  tablespoon: TBSP_ML,
  teaspoon: TSP_ML,
  fluidOunce: FLOZ_ML,
};

function roundNice(g: number): number {
  if (g >= 100) return Math.round(g / 5) * 5;
  if (g >= 20) return Math.round(g);
  return Math.round(g * 10) / 10;
}

type ConvertedUnit = { quantity: number; unit: string } | null;

function convertVolumeToMetric(
  quantity: number,
  unitId: string,
  description: string
): ConvertedUnit {
  const ml = VOLUME_UNIT_ML[unitId];
  if (!ml) return null;
  const density = lookupDensity(description);
  if (!density) return null;
  if (density.kind === 'liquid') {
    return { quantity: roundNice(quantity * ml), unit: 'ml' };
  }
  const grams = (quantity * ml * density.gramsPerCup) / CUP_ML;
  return { quantity: roundNice(grams), unit: 'g' };
}

function formatParsedIngredient(i: Ingredient): string {
  const parts: string[] = [];
  const q = i.quantity;
  const q2 = i.quantity2;

  const singleQty = q != null && q2 == null ? q : q == null && q2 != null ? q2 : null;
  if (singleQty != null && i.unitOfMeasureID) {
    const converted = convertVolumeToMetric(singleQty, i.unitOfMeasureID, i.description);
    if (converted) {
      return `${formatQuantity(converted.quantity)} ${converted.unit} ${i.description}`
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  if (q != null && q2 != null) {
    parts.push(`${formatQuantity(q)}–${formatQuantity(q2)}`);
  } else if (q != null) {
    parts.push(formatQuantity(q));
  } else if (q2 != null) {
    parts.push(formatQuantity(q2));
  }
  if (i.unitOfMeasure) parts.push(i.unitOfMeasure);
  if (i.description) parts.push(i.description);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function structureLines(lines: string[]): string[] {
  const cleaned = lines
    .map((l) => {
      try {
        return cleanIngredientLine(l).replace(EMOJI_LEADING_RE, '').trim();
      } catch {
        return cleanIngredientLine(l);
      }
    })
    .map(normalizeFractions)
    .map(normalizeFrenchUnits)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 2 && l.length <= 240);
  if (cleaned.length === 0) return [];

  let parsed: Ingredient[];
  try {
    parsed = parseIngredient(cleaned, PARSE_OPTS);
  } catch (err) {
    console.warn('[recipe] parseIngredient failed, falling back:', err);
    return dedupeCaseInsensitive(cleaned);
  }
  const out: string[] = [];
  for (let idx = 0; idx < parsed.length; idx++) {
    const p = parsed[idx];
    if (p.isGroupHeader) continue;
    const hasStructure = p.quantity != null || p.quantity2 != null || p.unitOfMeasure != null;
    if (hasStructure) {
      const formatted = formatParsedIngredient(p);
      out.push(formatted || cleaned[idx]);
    } else {
      out.push(cleaned[idx]);
    }
  }

  return dedupeCaseInsensitive(out);
}

function dedupeCaseInsensitive(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const key = s.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const INGREDIENT_HEADERS = [
  'ingrédients',
  'ingredients',
  'ingredient list',
  'liste des ingrédients',
  "ce qu'il vous faut",
  "ce qu'il te faut",
  'il vous faut',
  'il te faut',
  'you need',
  "you'll need",
  'shopping list',
  'courses',
  'ingredienti',
  'zutaten',
];

const STEP_HEADERS = [
  'étapes',
  'etapes',
  'steps',
  'instructions',
  'préparation',
  'preparation',
  'méthode',
  'method',
  'directions',
  'recette',
  'recipe',
  'how to',
  'procédé',
  'procedimento',
  'zubereitung',
  'réalisation',
  'realisation',
];

const SECTION_END_MARKERS = [
  'bon appétit',
  'bon app',
  'enjoy',
  'à vos fourneaux',
  'régalez',
  'régale-toi',
  'suivez-moi',
  'follow me',
  'follow for more',
  'more recipes',
  'plus de recettes',
];

const BULLET_SPLIT = /[•·●◦○▪▫◆◇]/g;
const BULLET_TRIM_LEFT = /^[\s•·●◦○▪▫◆◇★☆*–—\-→⇒➜➔➤➡▶►▸▹\u{FE0F}]+/u;
const BULLET_TRIM_RIGHT = /[\s•·●◦○▪▫◆◇★☆*–—\-→⇒➜➔➤➡▶►▸▹\u{FE0F}]+$/u;

const BULLET_LINE_RE =
  /^[\t ]*(?:[-–—*•·●◦○▪▫◆◇★☆✅✔☑▶►→⇒➜➔➤➡▸▹]\u{FE0F}?|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}])[\t ]+\S/u;

const EMOJI_NUMBERED_STEP_RE = /[1-9]\u{FE0F}?\u{20E3}/u;
const EMOJI_NUMBERED_STEP_RE_G = /[1-9]\u{FE0F}?\u{20E3}/gu;

const URL_RE = /https?:\/\/\S+/gi;
const MENTION_RE = /(?:^|\s)@[a-z0-9._-]+/gi;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCaption(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

type HeaderMatch = { kind: 'ingredients' | 'steps'; start: number; end: number };

function findHeaders(text: string): HeaderMatch[] {
  const matches: HeaderMatch[] = [];
  const buildRe = (headers: string[]) => {
    const words = headers.map(escapeRegExp).join('|');
    return new RegExp(
      `(?:^|\\n)[^\\n]{0,40}?\\b(?:${words})\\b(?=[\\s:：\\-–—.·\\n]|$)[\\s:：\\-–—.·]*`,
      'giu'
    );
  };
  const ingRe = buildRe(INGREDIENT_HEADERS);
  const stepRe = buildRe(STEP_HEADERS);

  let m: RegExpExecArray | null;
  while ((m = ingRe.exec(text)) !== null) {
    matches.push({ kind: 'ingredients', start: m.index, end: m.index + m[0].length });
  }
  while ((m = stepRe.exec(text)) !== null) {
    matches.push({ kind: 'steps', start: m.index, end: m.index + m[0].length });
  }
  return matches.sort((a, b) => a.start - b.start);
}

const META_EMOJI_END_RE = /(?:^|\n)\s*(?:⏱|⏲|🕐|👥|🍽|⭐|⚡)/gu;

function findEarliestEnd(fromIdx: number, text: string, otherHeaders: HeaderMatch[]): number {
  let end = text.length;
  for (const h of otherHeaders) {
    if (h.start > fromIdx && h.start < end) end = h.start;
  }
  const lower = text.toLowerCase();
  for (const marker of SECTION_END_MARKERS) {
    const idx = lower.indexOf(marker, fromIdx);
    if (idx >= 0 && idx < end) end = idx;
  }
  const hashtagIdx = text.indexOf('\n#', fromIdx);
  if (hashtagIdx >= 0 && hashtagIdx < end) end = hashtagIdx;
  const inlineHashtagIdx = text.indexOf(' #', fromIdx);
  if (inlineHashtagIdx >= 0 && inlineHashtagIdx < end) end = inlineHashtagIdx;

  META_EMOJI_END_RE.lastIndex = fromIdx;
  const metaMatch = META_EMOJI_END_RE.exec(text);
  if (metaMatch && metaMatch.index >= fromIdx && metaMatch.index < end) end = metaMatch.index;

  return end;
}

const QUANTITY_UNIT_SOURCE =
  '(\\d+(?:[.,/]\\d+)?)\\s*(g|kg|mg|ml|cl|L|oz|lb|lbs|tbsp|tsp|tbs|cup|cups|c\\.\\s*à\\.?\\s*s|c\\.\\s*à\\.?\\s*c|cuill[eè]re|pincée|pinch|dash|bunch|clove|cloves|piece|pieces|slice|slices|can|cans|bundle|bundles|scoop|scoops|œuf|œufs|oeuf|oeufs|egg|eggs|inch|inches)\\b';
const QUANTITY_UNIT = new RegExp(QUANTITY_UNIT_SOURCE, 'i');

function cleanIngredientLine(s: string): string {
  return s
    .replace(BULLET_TRIM_LEFT, '')
    .replace(BULLET_TRIM_RIGHT, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIngredientLines(section: string): string[] {
  const trimmedStart = section.replace(/^\n+/, '');
  const blankLineIdx = trimmedStart.search(/\n\s*\n/);
  const bounded = blankLineIdx >= 0 ? trimmedStart.slice(0, blankLineIdx) : trimmedStart;
  const cleaned = bounded.trim();
  if (!cleaned) return [];

  const bulletCount = (cleaned.match(BULLET_SPLIT) || []).length;
  let candidates: string[];

  if (bulletCount >= 2) {
    candidates = cleaned.split(BULLET_SPLIT);
  } else if (cleaned.includes('\n')) {
    candidates = cleaned.split('\n');
  } else {
    candidates = splitByQuantities(cleaned);
  }

  const seen = new Set<string>();
  return candidates
    .map(cleanIngredientLine)
    .filter((s) => s.length >= 2 && s.length <= 240)
    .filter((s) => !/^#/.test(s))
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function splitByQuantities(text: string): string[] {
  const parts: string[] = [];
  const re = new RegExp(QUANTITY_UNIT_SOURCE, 'gi');
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) indices.push(m.index);
  if (indices.length < 2) return [text];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : text.length;
    const chunk = text.slice(start, end).trim();
    if (chunk) parts.push(chunk);
  }
  return parts;
}

function cleanStepsSection(section: string): string {
  return section
    .replace(URL_RE, '')
    .replace(MENTION_RE, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function splitSteps(section: string): string[] {
  const cleaned = cleanStepsSection(section).replace(/^\n+|\n+$/g, '').trim();
  if (!cleaned) return [];

  if (EMOJI_NUMBERED_STEP_RE.test(cleaned)) {
    const raw = cleaned.split(EMOJI_NUMBERED_STEP_RE_G);
    const startsWithMarker = /^[1-9]\u{FE0F}?\u{20E3}/u.test(cleaned);
    const parts = (startsWithMarker ? raw.slice(1) : raw)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 3);
    if (parts.length >= 2) return parts;
  }

  const numbered = cleaned.match(/(?:^|\n)\s*\d+[.)]\s+[\s\S]*?(?=(?:\n\s*\d+[.)]\s+)|$)/g);
  if (numbered && numbered.length >= 2) {
    return numbered
      .map((s) => s.replace(/^\s*\d+[.)]\s+/, '').replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0);
  }

  const paragraphs = cleaned.split(/\n{2,}/);
  if (paragraphs.length >= 2) {
    return paragraphs
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 3);
  }

  const sentences = cleaned.match(/[^.!?]+[.!?]+[\s"'”)]*/g);
  if (sentences && sentences.length >= 2) {
    return sentences.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length > 3);
  }

  const one = cleaned.replace(/\s+/g, ' ').trim();
  return one ? [one] : [];
}

function findBulletBlock(text: string): string[] {
  const lines = text.split('\n');
  let bestStart = -1;
  let bestLen = 0;
  let currStart = -1;
  let currLen = 0;

  for (let i = 0; i < lines.length; i++) {
    if (BULLET_LINE_RE.test(lines[i])) {
      if (currLen === 0) currStart = i;
      currLen++;
      if (currLen > bestLen) {
        bestLen = currLen;
        bestStart = currStart;
      }
    } else {
      currLen = 0;
    }
  }

  if (bestLen < 2) return [];

  const block = lines.slice(bestStart, bestStart + bestLen).map(cleanIngredientLine);
  const kept = block.filter((s) => s.length >= 2 && s.length <= 240 && !/^#/.test(s));
  if (kept.length < 2) return [];

  const hasQty = kept.some((l) => QUANTITY_UNIT.test(l));
  const allShort = kept.every((l) => l.length <= 80);
  if (!hasQty && !allShort) return [];

  const seen = new Set<string>();
  return kept.filter((l) => {
    const key = l.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallbackIngredientHeuristic(text: string): string[] {
  const clean = text.replace(/\n?#[^\s#]+/g, ' ');
  const lines = clean.split('\n').map(cleanIngredientLine).filter((l) => l.length > 0);

  const quantifiedIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (QUANTITY_UNIT.test(lines[i]) && lines[i].length <= 160) quantifiedIdx.push(i);
  }

  if (quantifiedIdx.length >= 2) {
    const first = quantifiedIdx[0];
    const last = quantifiedIdx[quantifiedIdx.length - 1];
    const block = lines
      .slice(first, last + 1)
      .filter((l) => l.length >= 3 && l.length <= 160);
    return dedupeCaseInsensitive(block);
  }

  const chunks = splitByQuantities(clean);
  const found: string[] = [];
  for (const rawLine of chunks) {
    const line = cleanIngredientLine(rawLine);
    if (line.length < 3 || line.length > 160) continue;
    if (!QUANTITY_UNIT.test(line)) continue;
    found.push(line);
  }
  return dedupeCaseInsensitive(found);
}

const TIME_UNIT_TO_MIN: Record<string, number> = {
  h: 60,
  hr: 60,
  hrs: 60,
  hour: 60,
  hours: 60,
  heure: 60,
  heures: 60,
  min: 1,
  mn: 1,
  mins: 1,
  minute: 1,
  minutes: 1,
  m: 1,
};

function parseDuration(match: RegExpMatchArray | null): number | null {
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const unit = (match[2] ?? 'min').toLowerCase();
  const factor = TIME_UNIT_TO_MIN[unit] ?? 1;
  return Math.round(value * factor);
}

function extractDuration(text: string, keywords: string[]): number | null {
  const kw = keywords.map(escapeRegExp).join('|');
  const re = new RegExp(
    `(?:${kw})[ \\t]*[:=]?[ \\t]*(\\d+(?:[.,]\\d+)?)[ \\t]*(h|hr|hrs|hour|hours|heure|heures|min|mn|mins|minute|minutes|m)\\b`,
    'i'
  );
  return parseDuration(text.match(re));
}

function extractServings(text: string): number | null {
  const patterns: RegExp[] = [
    /(?:pour|serves?|for)\s+(\d+)\s*(?:personnes?|pers\.?|people|servings?|portions?)?/i,
    /(\d+)\s*(?:portions?|pers\.?|personnes?|servings?|people)\b/i,
    /(?:👥|🍽️?)\s*(\d+)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 100) return n;
    }
  }
  return null;
}

function extractDifficulty(text: string): Difficulty | null {
  const lower = text.toLowerCase();
  if (/\b(difficile|hard|advanced|expert)\b/.test(lower)) return 'difficile';
  if (/\b(moyen|medium|intermediate|intermédiaire)\b/.test(lower)) return 'moyen';
  if (/\b(facile|easy|simple|beginner|débutant)\b/.test(lower)) return 'facile';

  const stars = text.match(/⭐+/g);
  if (stars) {
    const max = Math.max(...stars.map((s) => Array.from(s).length));
    if (max >= 3) return 'difficile';
    if (max === 2) return 'moyen';
    if (max === 1) return 'facile';
  }
  return null;
}

export function extractMetadata(caption: string): RecipeMetadata {
  const prep = extractDuration(caption, [
    'prep',
    'préparation',
    'preparation',
    'prép',
    'prep time',
    'temps de préparation',
  ]);
  const cook = extractDuration(caption, [
    'cook',
    'cooking',
    'cuisson',
    'four',
    'baking',
    'cook time',
    'temps de cuisson',
  ]);
  const emojiDuration = parseDuration(
    caption.match(/(?:⏱|⏲|🕐)\s*(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|heure|heures|min|mn|mins|minute|minutes|m)\b/i)
  );
  const total =
    extractDuration(caption, ['total', 'temps total', 'total time']) ??
    (prep != null && cook != null ? prep + cook : null) ??
    emojiDuration;

  return {
    prepMinutes: prep,
    cookMinutes: cook,
    totalMinutes: total,
    servings: extractServings(caption),
    difficulty: extractDifficulty(caption),
  };
}

const TITLE_PATTERNS: RegExp[] = [
  /^\s*recette\s+(?:de\s+la\s+|de\s+l['\s]|des\s+|du\s+|de\s+)?([^\n.!?]{3,80})/i,
  /^\s*(?:comment\s+(?:faire|préparer|réussir)\s+(?:des?\s+|la\s+|le\s+|les\s+|un\s+|une\s+)?)([^\n.!?]{3,80})/i,
  /^\s*(?:how\s+to\s+make\s+)([^\n.!?]{3,80})/i,
  /^\s*(?:the\s+best\s+|la\s+meilleure\s+|le\s+meilleur\s+|les\s+meilleures?\s+)([^\n.!?]{3,80})/i,
];

function toTitleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1);
}

function stripTitleEmojisAndPunct(s: string): string {
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/^[\s\-–—•·:;"'“”«»]+|[\s\-–—•·:;"'“”«»]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractRecipeTitle(caption: string): string | null {
  if (!caption) return null;
  const normalized = normalizeCaption(caption);

  for (const re of TITLE_PATTERNS) {
    const m = normalized.match(re);
    if (m) {
      const candidate = stripTitleEmojisAndPunct(m[1]);
      if (candidate.length >= 3 && candidate.length <= 80) return toTitleCase(candidate);
    }
  }

  const headers = findHeaders(normalized);
  const cutoff = headers.length > 0 ? headers[0].start : normalized.length;
  const beforeHeaders = normalized.slice(0, cutoff);

  const lines = beforeHeaders
    .split('\n')
    .map(stripTitleEmojisAndPunct)
    .filter((l) => l.length > 0 && !/^#/.test(l));

  for (const line of lines) {
    if (line.length >= 3 && line.length <= 60 && !/^https?:\/\//i.test(line)) {
      return toTitleCase(line);
    }
  }

  const firstSentence = stripTitleEmojisAndPunct(beforeHeaders).match(/^([^.!?\n]{3,80})/);
  if (firstSentence) return toTitleCase(firstSentence[1].trim());

  return null;
}

export function parseRecipe(caption: string | null | undefined): ParsedRecipe {
  try {
    return parseRecipeUnsafe(caption);
  } catch (err) {
    console.warn('[recipe] parseRecipe crashed, returning raw caption:', err);
    return {
      title: null,
      ingredients: [],
      steps: [],
      metadata: EMPTY_METADATA,
      remainingNotes: (caption ?? '').slice(0, 400),
      detected: false,
    };
  }
}

function parseRecipeUnsafe(caption: string | null | undefined): ParsedRecipe {
  const empty: ParsedRecipe = {
    title: null,
    ingredients: [],
    steps: [],
    metadata: EMPTY_METADATA,
    remainingNotes: '',
    detected: false,
  };
  if (!caption) return empty;

  const text = normalizeCaption(caption);
  const headers = findHeaders(text);

  const ingHeader = headers.find((h) => h.kind === 'ingredients');
  const firstStepAfterIng = headers.find(
    (h) => h.kind === 'steps' && (!ingHeader || h.start > ingHeader.start)
  );
  const stepHeader = firstStepAfterIng ?? headers.find((h) => h.kind === 'steps');

  let rawIngredients: string[] = [];
  let steps: string[] = [];
  let detected = false;

  if (ingHeader) {
    const others = headers.filter((h) => h !== ingHeader);
    const end = findEarliestEnd(ingHeader.end, text, others);
    rawIngredients = splitIngredientLines(text.slice(ingHeader.end, end));
    detected = rawIngredients.length > 0;
  }

  if (stepHeader) {
    const others = headers.filter((h) => h !== stepHeader);
    const end = findEarliestEnd(stepHeader.end, text, others);
    steps = splitSteps(text.slice(stepHeader.end, end));
    if (steps.length > 0) detected = true;
  }

  if (rawIngredients.length === 0) {
    const bulletList = findBulletBlock(text);
    if (bulletList.length >= 2) {
      rawIngredients = bulletList;
      detected = true;
    }
  }

  if (rawIngredients.length === 0) {
    const guessed = fallbackIngredientHeuristic(text);
    if (guessed.length >= 2) {
      rawIngredients = guessed;
      detected = true;
    }
  }

  if (steps.length === 0) {
    const firstEmojiIdx = text.search(EMOJI_NUMBERED_STEP_RE);
    if (firstEmojiIdx >= 0) {
      const sectionEnd = findEarliestEnd(firstEmojiIdx, text, headers);
      const guessedSteps = splitSteps(text.slice(firstEmojiIdx, sectionEnd));
      if (guessedSteps.length >= 2) {
        steps = guessedSteps;
        detected = true;
      }
    }
  }

  const ingredients = rawIngredients.length > 0 ? structureLines(rawIngredients) : [];

  const withoutHashtags = text.replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim();
  const remaining = withoutHashtags.slice(0, 400);

  const title = extractRecipeTitle(caption);
  const metadata = extractMetadata(text);

  return {
    title,
    ingredients,
    steps,
    metadata,
    remainingNotes: remaining,
    detected,
  };
}
