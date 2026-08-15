export type ParsedRecipe = {
  ingredients: string[];
  steps: string[];
  remainingNotes: string;
  detected: boolean;
};

const INGREDIENT_HEADERS = [
  'ingrédients',
  'ingredients',
  'ingredient list',
  'liste des ingrédients',
  "ce qu'il vous faut",
  "ce qu'il te faut",
  'il vous faut',
  'you need',
  "you'll need",
  'shopping list',
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
  'cuisson',
  'how to',
  'procédé',
  'zubereitung',
  'procedimento',
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
const BULLET_TRIM_LEFT = /^[\s•·●◦○▪▫◆◇★☆*–—-]+/;
const BULLET_TRIM_RIGHT = /[\s•·●◦○▪▫◆◇★☆*–—-]+$/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCaption(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

type HeaderMatch = { kind: 'ingredients' | 'steps'; start: number; end: number };

function findHeaders(text: string): HeaderMatch[] {
  const matches: HeaderMatch[] = [];
  const buildRe = (headers: string[]) => {
    const words = headers.map(escapeRegExp).join('|');
    return new RegExp(
      `(?:^|\\n)[^\\n]{0,15}?\\b(?:${words})\\b(?=[\\s:：\\-–—.·\\n]|$)[\\s:：\\-–—.·]*`,
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
  return end;
}

const QUANTITY_UNIT_SOURCE =
  '(\\d+(?:[.,/]\\d+)?)\\s*(g|kg|mg|ml|cl|L|oz|lb|lbs|tbsp|tsp|tbs|cup|cups|pincée|pinch|dash|bunch|clove|cloves|piece|pieces|slice|slices|can|cans|bundle|bundles|scoop|scoops|œuf|œufs|oeuf|oeufs|egg|eggs|inch|inches)\\b';
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

function splitSteps(section: string): string[] {
  const cleaned = section.replace(/^\n+|\n+$/g, '').trim();
  if (!cleaned) return [];

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

function fallbackIngredientHeuristic(text: string): string[] {
  const clean = text.replace(/\n?#[^\s#]+/g, ' ');
  const chunks = splitByQuantities(clean);
  const found: string[] = [];
  for (const rawLine of chunks) {
    const line = cleanIngredientLine(rawLine);
    if (line.length < 3 || line.length > 160) continue;
    if (!QUANTITY_UNIT.test(line)) continue;
    found.push(line);
  }
  const seen = new Set<string>();
  return found.filter((l) => {
    const key = l.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseRecipe(caption: string | null | undefined): ParsedRecipe {
  const empty: ParsedRecipe = { ingredients: [], steps: [], remainingNotes: '', detected: false };
  if (!caption) return empty;

  const text = normalizeCaption(caption);
  const headers = findHeaders(text);

  const ingHeader = headers.find((h) => h.kind === 'ingredients');
  const firstStepAfterIng = headers.find(
    (h) => h.kind === 'steps' && (!ingHeader || h.start > ingHeader.start)
  );
  const stepHeader = firstStepAfterIng ?? headers.find((h) => h.kind === 'steps');

  let ingredients: string[] = [];
  let steps: string[] = [];
  let detected = false;

  if (ingHeader) {
    const others = headers.filter((h) => h !== ingHeader);
    const end = findEarliestEnd(ingHeader.end, text, others);
    ingredients = splitIngredientLines(text.slice(ingHeader.end, end));
    detected = ingredients.length > 0;
  }

  if (stepHeader) {
    const others = headers.filter((h) => h !== stepHeader);
    const end = findEarliestEnd(stepHeader.end, text, others);
    steps = splitSteps(text.slice(stepHeader.end, end));
    if (steps.length > 0) detected = true;
  }

  if (!detected) {
    const guessed = fallbackIngredientHeuristic(text);
    if (guessed.length >= 3) {
      ingredients = guessed;
      detected = true;
    }
  }

  const withoutHashtags = text.replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim();
  const remaining = withoutHashtags.slice(0, 400);

  return {
    ingredients,
    steps,
    remainingNotes: remaining,
    detected,
  };
}
