export const colors = {
  paper: '#FBF7F0',
  paperElevated: '#FFFCF6',
  paperSunken: '#F3ECDE',

  ink: '#1B1B1F',
  inkMuted: '#57534E',
  inkFaint: '#A8A29E',

  line: '#EDE7DA',
  lineStrong: '#DED4BE',

  accent: '#D64545',
  accentPressed: '#B93A3A',
  accentSoft: '#FDE4E4',

  amber: '#E8A33D',
  amberSoft: '#FDF3D8',

  sage: '#5F8B65',
  sageSoft: '#E4EEE1',

  instagram: '#E4405F',
  tiktok: '#1B1B1F',

  danger: '#B42318',
  dangerSoft: '#FEE4E2',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(27, 27, 31, 0.4)',
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

export const fonts = {
  serif: 'Fraunces_600SemiBold',
  serifBold: 'Fraunces_700Bold',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifRegular: 'Fraunces_500Medium',
} as const;

export const shadow = {
  card: {
    shadowColor: '#3D2E13',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowColor: '#3D2E13',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

export const theme = { colors, radii, space, fonts, shadow };
export type Theme = typeof theme;
