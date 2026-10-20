import type { FontPreset, ThemeColours } from '../types';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colours: ThemeColours;
  background: {
    colour: string;
    gradient: string;
    overlay: number;
  };
}

const classicGradient =
  'radial-gradient(ellipse at 50% -20%, rgba(118, 169, 224, 0.24), transparent 55%), linear-gradient(180deg, #1b232d 0%, #15191f 58%, #101419 100%)';

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic-igoogle-dark',
    name: 'Classic iGoogle Dark',
    description: 'The default: charcoal panels, steel-blue gloss and a 2008 soul.',
    colours: {
      bg: '#15191f',
      contentBg: '#1d232c',
      widgetBg: '#252c36',
      headerTop: '#415670',
      headerBottom: '#26374c',
      accent: '#76a9e0',
      text: '#e8edf4',
      muted: '#a7b3c2',
      border: '#455467',
    },
    background: {
      colour: '#15191f',
      gradient: classicGradient,
      overlay: 0.25,
    },
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    description: 'Deep navy with a brighter cyber-blue accent.',
    colours: {
      bg: '#0c1420',
      contentBg: '#111d2c',
      widgetBg: '#172738',
      headerTop: '#244b72',
      headerBottom: '#13293f',
      accent: '#5fb4ff',
      text: '#e6f1ff',
      muted: '#9db4cc',
      border: '#2c4a68',
    },
    background: {
      colour: '#0c1420',
      gradient:
        'radial-gradient(ellipse at 20% 0%, rgba(60, 140, 220, 0.22), transparent 50%), linear-gradient(180deg, #0e1926 0%, #0c1420 70%, #080d14 100%)',
      overlay: 0.3,
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Brushed metal greys with a restrained silver accent.',
    colours: {
      bg: '#181a1c',
      contentBg: '#202326',
      widgetBg: '#2a2e32',
      headerTop: '#4b535b',
      headerBottom: '#30363c',
      accent: '#b9c8d6',
      text: '#eef1f3',
      muted: '#aab2ba',
      border: '#4a5158',
    },
    background: {
      colour: '#181a1c',
      gradient:
        'radial-gradient(ellipse at 70% -10%, rgba(200, 215, 230, 0.12), transparent 55%), linear-gradient(180deg, #202326 0%, #181a1c 65%, #111315 100%)',
      overlay: 0.25,
    },
  },
  {
    id: 'retro-green',
    name: 'Retro Green',
    description: 'Terminal-inspired forest tones with a phosphor glow.',
    colours: {
      bg: '#101710',
      contentBg: '#172117',
      widgetBg: '#1e2b1e',
      headerTop: '#3f6142',
      headerBottom: '#243b27',
      accent: '#8fd694',
      text: '#e8f3e7',
      muted: '#a5bda3',
      border: '#425a44',
    },
    background: {
      colour: '#101710',
      gradient:
        'radial-gradient(ellipse at 50% -20%, rgba(120, 210, 130, 0.18), transparent 55%), linear-gradient(180deg, #172117 0%, #101710 70%, #0a100a 100%)',
      overlay: 0.22,
    },
  },
  {
    id: 'dark-purple',
    name: 'Dark Purple',
    description: 'Plum panels and a violet glow for late-night browsing.',
    colours: {
      bg: '#17121f',
      contentBg: '#20182b',
      widgetBg: '#2a2037',
      headerTop: '#5a4378',
      headerBottom: '#352546',
      accent: '#c39bf0',
      text: '#f1eaf7',
      muted: '#b7a7c7',
      border: '#584367',
    },
    background: {
      colour: '#17121f',
      gradient:
        'radial-gradient(ellipse at 25% -10%, rgba(180, 120, 240, 0.2), transparent 55%), linear-gradient(180deg, #21182c 0%, #17121f 68%, #0f0b15 100%)',
      overlay: 0.24,
    },
  },
];

export const DEFAULT_THEME = THEME_PRESETS[0];

export const FONT_FAMILIES: Record<FontPreset, string> = {
  retro: '"Trebuchet MS", Verdana, Tahoma, Arial, sans-serif',
  modern:
    '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
};

export const BACKGROUND_GRADIENTS: Array<{ id: string; name: string; value: string }> = [
  { id: 'steel', name: 'Steel sky', value: classicGradient },
  {
    id: 'deep-navy',
    name: 'Deep navy',
    value:
      'radial-gradient(ellipse at 50% -10%, rgba(70, 130, 200, 0.22), transparent 55%), linear-gradient(180deg, #16222e, #0c1117)',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    value:
      'radial-gradient(ellipse at 70% -10%, rgba(210, 220, 230, 0.1), transparent 50%), linear-gradient(180deg, #23272b, #121416)',
  },
  {
    id: 'forest',
    name: 'Forest',
    value:
      'radial-gradient(ellipse at 30% -10%, rgba(100, 190, 110, 0.16), transparent 55%), linear-gradient(180deg, #1a261a, #0b100b)',
  },
  {
    id: 'violet',
    name: 'Violet dusk',
    value:
      'radial-gradient(ellipse at 20% 0%, rgba(180, 120, 240, 0.2), transparent 55%), linear-gradient(180deg, #241a30, #100c16)',
  },
  {
    id: 'sunset',
    name: 'Copper sunset',
    value:
      'radial-gradient(ellipse at 70% -10%, rgba(235, 150, 90, 0.18), transparent 55%), linear-gradient(180deg, #2a1d19, #130e0c)',
  },
];

export function themeById(id: string): ThemePreset {
  return THEME_PRESETS.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}
