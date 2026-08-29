/**
 * stampTheme.js
 *
 * The single palette for the stamp pipeline (Camera -> StampDetail -> SavedStamp).
 * Screen chrome outside the stamp flow still uses ../styles/theme.
 */

export const STAMP_COLORS = {
  /** App background - soft violet off-white */
  background: '#FAF8FC',
  /** Stamp paper - neutral white so captured photos remain true to colour */
  paper: '#FEFCFF',
  /** Inner hairline where paper meets photo */
  paperEdge: 'rgba(0,0,0,0.06)',

  shadow: '#000000',
  shadowOpacity: 0.2,

  textPrimary: '#2F233B',
  textSecondary: '#786D82',
  textMuted: '#A69AAD',

  accent: '#5B2B8A',
  secondary: '#E4943A',
  accentSoft: '#F1E9F8',
  surface: '#FFFFFF',
  border: '#E5DDEC',
  dark: '#2A1C38',
};

export const SPACE = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};
