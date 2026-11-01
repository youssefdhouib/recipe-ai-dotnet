/** @type {import('tailwindcss').Config} */
// Design tokens: "Sfax kitchen" — Nabeul ceramic cobalt + saffron, olive for what you have, harissa for what is missing.
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#141B34', soft: '#4A5170', faint: '#8A90A8' },
        paper: '#F5F6FA',
        line: '#E3E5EE',
        cobalt: { 50: '#EEF2FC', 100: '#DCE4FA', 500: '#2F55C9', 600: '#1F3FA8', 700: '#183285' },
        saffron: { 100: '#FDF1D6', 400: '#F2B33D', 600: '#C98A12' },
        olive: { 100: '#E8EFDC', 600: '#5B7B3A', 700: '#476230' },
        harissa: { 100: '#FBE4DF', 600: '#C2361F' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        lift: '0 1px 2px rgba(20,27,52,.06), 0 8px 24px -12px rgba(20,27,52,.18)',
      },
      keyframes: {
        // Starts partly visible on purpose: if animations are paused (background tab), content still shows.
        rise: { '0%': { opacity: '0.4', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        rise: 'rise .45s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
};
