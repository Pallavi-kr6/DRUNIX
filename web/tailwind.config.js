/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'media',
  theme: { extend: {
    colors: { navy: { DEFAULT: '#0f1f3a', 2: '#182c4d' }, teal: { DEFAULT: '#0f8f7e', bg: '#e4f4f1' }, amber: { DEFAULT: '#b7791f', bg: '#fdf3dc' }, alert: { DEFAULT: '#c0392b', bg: '#fbe9e7' }, canvas: '#f4f6f9', line: '#dde2ea', mute: '#5d6b80', ink: '#16202f', holderA: '#2b6cb0', holderB: '#0f8f7e', holderC: '#8a5cc2', holderD: '#c26b1f' },
    fontFamily: { sans: ['Inter', 'Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
  } },
  plugins: [],
};
