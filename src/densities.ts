export type Density = {
  gramsPerCup: number;
  kind: 'solid' | 'liquid';
  aliases: string[];
};

export const CUP_ML = 240;
export const TBSP_ML = 15;
export const TSP_ML = 5;
export const FLOZ_ML = 30;

export const INGREDIENT_DENSITIES: Density[] = [
  { gramsPerCup: 120, kind: 'solid', aliases: ['all-purpose flour', 'plain flour', 'ap flour', 'flour', 'farine', 'farine blanche', 'farine t45', 'farine t55', 'farine t65'] },
  { gramsPerCup: 120, kind: 'solid', aliases: ['bread flour', 'strong flour', 'farine de gruau'] },
  { gramsPerCup: 114, kind: 'solid', aliases: ['cake flour', 'farine à gâteau'] },
  { gramsPerCup: 113, kind: 'solid', aliases: ['whole wheat flour', 'wholemeal flour', 'farine complète', 'farine intégrale', 'farine t150'] },
  { gramsPerCup: 96,  kind: 'solid', aliases: ['almond flour', 'almond meal', 'poudre d\'amande', 'poudre d\'amandes', 'farine d\'amande'] },
  { gramsPerCup: 128, kind: 'solid', aliases: ['cornstarch', 'corn starch', 'cornflour', 'maïzena', 'maizena', 'fécule de maïs', 'fecule de mais'] },

  { gramsPerCup: 200, kind: 'solid', aliases: ['granulated sugar', 'white sugar', 'caster sugar', 'sugar', 'sucre', 'sucre blanc', 'sucre en poudre', 'sucre semoule'] },
  { gramsPerCup: 220, kind: 'solid', aliases: ['brown sugar', 'light brown sugar', 'dark brown sugar', 'packed brown sugar', 'sucre roux', 'sucre brun', 'cassonade', 'vergeoise'] },
  { gramsPerCup: 120, kind: 'solid', aliases: ['powdered sugar', 'confectioners sugar', 'icing sugar', 'sucre glace'] },
  { gramsPerCup: 200, kind: 'solid', aliases: ['coconut sugar', 'sucre de coco'] },

  { gramsPerCup: 227, kind: 'solid', aliases: ['butter', 'unsalted butter', 'salted butter', 'melted butter', 'softened butter', 'beurre', 'beurre doux', 'beurre demi-sel', 'beurre fondu', 'beurre pommade'] },
  { gramsPerCup: 258, kind: 'solid', aliases: ['peanut butter', 'beurre de cacahuète', 'beurre de cacahuetes', 'beurre de cacahuètes'] },
  { gramsPerCup: 224, kind: 'solid', aliases: ['cream cheese', 'fromage frais', 'fromage à la crème', 'philadelphia'] },
  { gramsPerCup: 245, kind: 'solid', aliases: ['yogurt', 'yoghurt', 'greek yogurt', 'yaourt', 'yaourt grec', 'yaourt nature'] },
  { gramsPerCup: 245, kind: 'solid', aliases: ['sour cream', 'crème aigre', 'crème acidulée'] },
  { gramsPerCup: 245, kind: 'solid', aliases: ['ricotta', 'ricotta cheese'] },
  { gramsPerCup: 113, kind: 'solid', aliases: ['grated cheese', 'shredded cheese', 'grated parmesan', 'parmesan râpé', 'gruyère râpé', 'emmental râpé', 'fromage râpé'] },

  { gramsPerCup: 85,  kind: 'solid', aliases: ['cocoa powder', 'unsweetened cocoa', 'cacao en poudre', 'cacao'] },
  { gramsPerCup: 170, kind: 'solid', aliases: ['chocolate chips', 'chocolate chunks', 'pépites de chocolat', 'pepites de chocolat', 'chocolat en morceaux', 'chocolat concassé', 'chocolat noir', 'chocolat au lait', 'chocolat blanc'] },
  { gramsPerCup: 120, kind: 'solid', aliases: ['chopped nuts', 'walnuts', 'noix', 'noix concassées', 'noix hachées'] },
  { gramsPerCup: 143, kind: 'solid', aliases: ['almonds', 'chopped almonds', 'sliced almonds', 'amandes', 'amandes effilées', 'amandes concassées'] },
  { gramsPerCup: 149, kind: 'solid', aliases: ['pecans', 'noix de pécan', 'noix de pecan'] },
  { gramsPerCup: 145, kind: 'solid', aliases: ['raisins', 'raisins secs'] },
  { gramsPerCup: 152, kind: 'solid', aliases: ['dried cranberries', 'canneberges séchées'] },
  { gramsPerCup: 150, kind: 'solid', aliases: ['dates', 'chopped dates', 'dattes', 'dattes dénoyautées'] },
  { gramsPerCup: 149, kind: 'solid', aliases: ['shredded coconut', 'desiccated coconut', 'noix de coco râpée', 'noix de coco rapee'] },

  { gramsPerCup: 185, kind: 'solid', aliases: ['rice', 'uncooked rice', 'white rice', 'basmati rice', 'jasmine rice', 'riz', 'riz basmati', 'riz thaï', 'riz long grain'] },
  { gramsPerCup: 190, kind: 'solid', aliases: ['brown rice', 'riz complet', 'riz brun'] },
  { gramsPerCup: 195, kind: 'solid', aliases: ['arborio rice', 'risotto rice', 'riz à risotto', 'riz arborio'] },
  { gramsPerCup: 90,  kind: 'solid', aliases: ['rolled oats', 'oats', 'oatmeal', 'flocons d\'avoine', 'avoine'] },
  { gramsPerCup: 200, kind: 'solid', aliases: ['quinoa'] },
  { gramsPerCup: 170, kind: 'solid', aliases: ['couscous', 'semoule'] },
  { gramsPerCup: 108, kind: 'solid', aliases: ['breadcrumbs', 'panko', 'chapelure', 'chapelure panko'] },

  { gramsPerCup: 288, kind: 'solid', aliases: ['salt', 'table salt', 'sel', 'sel fin', 'gros sel'] },
  { gramsPerCup: 192, kind: 'solid', aliases: ['baking powder', 'levure chimique', 'poudre à lever'] },
  { gramsPerCup: 220, kind: 'solid', aliases: ['baking soda', 'bicarbonate', 'bicarbonate de soude'] },

  { gramsPerCup: 240, kind: 'liquid', aliases: ['milk', 'whole milk', 'skim milk', 'lait', 'lait entier', 'lait demi-écrémé', 'lait écrémé', 'lait végétal', 'lait d\'amande', 'lait d\'avoine', 'lait de coco', 'lait de soja'] },
  { gramsPerCup: 245, kind: 'liquid', aliases: ['heavy cream', 'whipping cream', 'double cream', 'crème', 'crème liquide', 'crème fraîche', 'crème entière', 'creme fleurette'] },
  { gramsPerCup: 240, kind: 'liquid', aliases: ['buttermilk', 'lait fermenté', 'lait ribot'] },
  { gramsPerCup: 240, kind: 'liquid', aliases: ['water', 'eau', 'eau tiède', 'eau froide', 'eau chaude'] },
  { gramsPerCup: 218, kind: 'liquid', aliases: ['oil', 'vegetable oil', 'canola oil', 'sunflower oil', 'olive oil', 'huile', 'huile végétale', 'huile de tournesol', 'huile d\'olive', 'huile de colza', 'huile de coco'] },
  { gramsPerCup: 340, kind: 'liquid', aliases: ['honey', 'miel'] },
  { gramsPerCup: 322, kind: 'liquid', aliases: ['maple syrup', 'sirop d\'érable', 'sirop d\'erable'] },
  { gramsPerCup: 328, kind: 'liquid', aliases: ['molasses', 'mélasse'] },
  { gramsPerCup: 300, kind: 'liquid', aliases: ['corn syrup', 'sirop de maïs', 'sirop de glucose'] },
  { gramsPerCup: 240, kind: 'liquid', aliases: ['juice', 'orange juice', 'lemon juice', 'jus', 'jus d\'orange', 'jus de citron', 'jus de pomme'] },
  { gramsPerCup: 240, kind: 'liquid', aliases: ['broth', 'stock', 'bouillon', 'bouillon de légumes', 'bouillon de volaille', 'bouillon de bœuf'] },
  { gramsPerCup: 240, kind: 'liquid', aliases: ['wine', 'red wine', 'white wine', 'vin', 'vin rouge', 'vin blanc'] },
  { gramsPerCup: 240, kind: 'liquid', aliases: ['vinegar', 'balsamic vinegar', 'vinaigre', 'vinaigre balsamique', 'vinaigre de cidre'] },
  { gramsPerCup: 240, kind: 'liquid', aliases: ['soy sauce', 'sauce soja', 'sauce soya'] },
  { gramsPerCup: 240, kind: 'liquid', aliases: ['coconut milk', 'lait de coco'] },
];

type Match = { density: Density; aliasLen: number };

const NORMALIZED_ALIASES: Array<{ alias: string; density: Density }> = INGREDIENT_DENSITIES
  .flatMap((d) => d.aliases.map((a) => ({ alias: a.toLowerCase(), density: d })))
  .sort((a, b) => b.alias.length - a.alias.length);

export function lookupDensity(description: string): Density | null {
  const desc = description.toLowerCase();
  let best: Match | null = null;
  for (const { alias, density } of NORMALIZED_ALIASES) {
    const re = new RegExp(`(?:^|[^\\p{L}])${escapeRegExp(alias)}(?:[^\\p{L}]|$)`, 'u');
    if (re.test(desc)) {
      if (!best || alias.length > best.aliasLen) {
        best = { density, aliasLen: alias.length };
      }
    }
  }
  return best?.density ?? null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
