/** Author: BinaryBeast1209 */
import { useWindowDimensions } from 'react-native';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = width >= 600;
  const isDesktop = width >= 1024;
  const compact = width < 420;
  const narrow = width < 370;
  const short = height < 700;

  // Responsive padding: comfortable on small screens, spacious on tablets
  const pad = narrow ? 14 : compact ? 18 : isTablet ? 32 : 24;

  // Maximum container width for centering on tablet/desktop screens
  const maxContentWidth = isDesktop ? 680 : isTablet ? 600 : 460;

  // Responsive typography
  const display = narrow ? 24 : compact ? 28 : isTablet ? 40 : 34;
  const displayLine = narrow ? 30 : compact ? 34 : isTablet ? 48 : 42;
  const title = narrow ? 22 : compact ? 26 : isTablet ? 36 : 30;
  const titleLine = narrow ? 28 : compact ? 32 : isTablet ? 42 : 36;
  const subtitle = narrow ? 13 : compact ? 14 : isTablet ? 17 : 15;
  const body = narrow ? 14 : compact ? 15 : isTablet ? 18 : 16;
  const bodyLine = narrow ? 20 : compact ? 22 : isTablet ? 26 : 24;
  const caption = narrow ? 11 : 12;

  // Dynamic Camera & Viewport Sizing
  const cameraSize = Math.round(Math.min(width - pad * 2, short ? 240 : isTablet ? 380 : 300));
  const cameraViewportHeight = short ? 200 : isTablet ? 320 : 250;

  return {
    width,
    height,
    isLandscape,
    isTablet,
    isDesktop,
    compact,
    narrow,
    short,
    pad,
    maxContentWidth,
    display,
    displayLine,
    title,
    titleLine,
    subtitle,
    body,
    bodyLine,
    caption,
    cameraSize,
    cameraViewportHeight,
    iris: short ? 72 : compact ? 96 : isTablet ? 140 : 120,
  };
}
