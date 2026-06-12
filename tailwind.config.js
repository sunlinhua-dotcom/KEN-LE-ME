/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ── 坑了么 2.0 · Noir Cellar 色板 ──
        primary: '#FF2E7E',        // 酒渍红(品牌主色)
        'primary-deep': '#B3124F',
        wine: '#7A1638',
        gold: '#E8C268',
        'gold-soft': '#F5DFA6',
        void: '#060410',
        abyss: '#0E0818',
        mint: '#2EE6A8',           // 良心
        warm: '#FFC24B',           // 正常
        blaze: '#FF5A5F',          // 巨坑
        scan: '#6FB3FF',           // 鉴定
        secondary: '#0E0818',
      },
      borderRadius: {
        '4xl': '32px',
      },
    },
  },
  plugins: [],
}
