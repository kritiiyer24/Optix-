/** Author: BinaryBeast1209 */
import { Platform } from 'react-native';

export const brand = {
  name: 'Optix',
  tagline: 'See how their vision is changing.',
};

export const colors = {
  bg: '#F3EEE6',
  bgDeep: '#E8E0D4',
  card: '#FFFBF6',
  cardInk: '#1F2A26',
  text: '#1C1915',
  secondary: '#5F584E',
  muted: '#8A8278',
  line: '#E4DCD0',
  accent: '#1F6B63',
  accentDeep: '#164F49',
  accentSoft: '#D7EBE7',
  gold: '#C9894A',
  goldSoft: '#F4E6D4',
  success: '#3C7A56',
  successSoft: '#DCEBDF',
  warning: '#B86A2D',
  warningSoft: '#F6E5D4',
  danger: '#9A4A3C',
  inkSoft: 'rgba(28, 25, 21, 0.06)',
};

export const radius = {
  card: 22,
  button: 16,
  pill: 999,
  camera: 28,
};

export const fonts = {
  display: Platform.select({
    web: 'Fraunces, Georgia, serif',
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia',
  }) as string,
  sans: Platform.select({
    web: 'DM Sans, system-ui, sans-serif',
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }) as string,
};

export const textBase = {
  fontFamily: fonts.sans,
  letterSpacing: 0.2,
};

export const displayBase = {
  fontFamily: fonts.display,
  fontWeight: '500' as const,
  letterSpacing: 0.15,
};

export const shadow = {
  card: {
    shadowColor: '#1C1915',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
};

export function loadWebFonts(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!document.getElementById('optix-fonts')) {
    const link = document.createElement('link');
    link.id = 'optix-fonts';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&display=swap';
    document.head.appendChild(link);
  }
  if (document.getElementById('optix-wrap')) return;
  const css = document.createElement('style');
  css.id = 'optix-wrap';
  css.textContent = `
    html, body, #root { max-width: 100%; overflow-x: hidden; }
    html, body, #root, [dir="auto"] { font-synthesis: none !important; }
  `;
  document.head.appendChild(css);
}
