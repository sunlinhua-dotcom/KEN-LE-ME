/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/* ────────────────────────────────────────────────────────────────
 * 坑了么 2.0 · "Noir Cellar 酒窖暗夜" 设计令牌
 * 深邃酒窖黑 + 醒目酒渍红 + 香槟金,三大鉴定色(良心/正常/巨坑)
 * ──────────────────────────────────────────────────────────────── */
export const KC = {
  /** 背景层 */
  void: '#060410',          // 最深背景(虚空黑)
  abyss: '#0E0818',         // 次级背景
  panel: 'rgba(255,255,255,0.055)', // 玻璃面板
  panelBorder: 'rgba(255,255,255,0.12)',

  /** 品牌主色 */
  crimson: '#FF2E7E',       // 主色 · 酒渍红(品牌粉的升级)
  crimsonDeep: '#B3124F',   // 主色深
  wine: '#7A1638',          // 葡萄酒红
  gold: '#E8C268',          // 香槟金
  goldSoft: '#F5DFA6',      // 浅金高光

  /** 鉴定结论色 */
  mint: '#2EE6A8',          // ✅ 良心
  amber: '#FFC24B',         // 👌 正常
  blaze: '#FF5A5F',         // 💣 巨坑
  scan: '#6FB3FF',          // 🔍 鉴定(无店内价)

  /** 文字 */
  textHi: '#F7F3F9',
  textMid: 'rgba(247,243,249,0.72)',
  textLow: 'rgba(247,243,249,0.42)',
} as const;

/** 数字/拉丁字符的衬线字体栈(系统字体,无需联网,中国大陆可用) */
export const SerifNum = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: "Georgia, 'Times New Roman', 'Songti SC', serif",
});
