import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'hero'
    | 'screenTitle'
    | 'section'
    | 'eyebrow'
    | 'caption'
    | 'captionBold'
    | 'stat';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'hero' && styles.hero,
        type === 'screenTitle' && styles.screenTitle,
        type === 'section' && styles.section,
        type === 'eyebrow' && styles.eyebrow,
        type === 'caption' && styles.caption,
        type === 'captionBold' && styles.captionBold,
        type === 'stat' && styles.stat,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
  // --- Habito typography scale ---
  /** Welcome/brand wordmark. */
  hero: {
    fontFamily: Fonts.serif,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '700',
  },
  /** Serif screen titles: Today, Timeline, Analytics, New habit. */
  screenTitle: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
  },
  /** Card/section headings. */
  section: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  /** Small letterspaced uppercase label (WELCOME TO, CURRENT STREAK, RECURRING). */
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  captionBold: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  /** Big statistic number. */
  stat: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
  },
}) satisfies Record<string, TextStyle>;
