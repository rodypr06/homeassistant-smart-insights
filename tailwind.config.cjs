/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#3B82F6',
        'primary-blue-dark': '#1D4ED8',
        'secondary-blue': '#60A5FA',
        'background-primary': '#FFFFFF',
        'background-secondary': '#F8FAFC',
        'background-tertiary': '#F1F5F9',
        'text-primary': '#1E293B',
        'text-secondary': '#64748B',
        'border-color': '#E2E8F0',
        'shadow-color': 'rgba(0, 0, 0, 0.1)',
        'dark-primary-blue': '#60A5FA',
        'dark-background-primary': '#0F172A',
        'dark-background-secondary': '#1E293B',
        'dark-background-tertiary': '#334155',
        'dark-text-primary': '#F8FAFC',
        'dark-text-secondary': '#CBD5E1',
        'dark-border-color': '#475569',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
} 