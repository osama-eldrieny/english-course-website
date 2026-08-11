/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        /* ─ Brand palette: deep navy + desert gold + terra cotta on warm neutrals ─ */
        'navy': '#1e3a5f',
        'navy-deep': '#152b47',
        'navy-tint': '#d7dce2',
        'slate-blue': '#4a5f82',
        'slate-tint': '#dee2e9',
        'gold': '#f4b731',
        'gold-tint': '#fce9c1',
        'gold-deep': '#c98f18',
        'gold-text': '#7d5608',
        'terra': '#c1543c',
        'terra-tint': '#ecccc4',
        'cream': '#f0e7d5',
        'tan': '#c9b892',
        'tan-tint': '#e4dcc6',

        /* ─ Legacy token names, remapped onto the new palette ─
           Kept so existing markup keeps rendering; prefer the names above. */
        'primary-blue': '#1e3a5f',
        'primary-blue-light': '#d7dce2',
        'primary-blue-mid': '#4a5f82',
        'accent-amber': '#f4b731',
        'accent-amber-light': '#fce9c1',
        'accent-teal': '#4a5f82',
        'accent-teal-light': '#dee2e9',
        'success-green': '#1e8a5c',
        'success-green-light': '#e7f7f0',
        'error-red': '#c1543c',
        'error-red-light': '#ecccc4',
        'gray-50-custom': '#f8f9fa',
        'gray-100-custom': '#f1f3f4',
        'gray-200-custom': '#e8eaed',
        'gray-400-custom': '#9aa0a6',
        'gray-600-custom': '#5f6368',
        'gray-800-custom': '#3c4043',
        'gray-900-custom': '#202124',
        'bg-warm': '#fffdf7',
      },
      fontFamily: {
        'sans': ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        /* Headings use the same family at heavier weights — see input.css */
        'serif': ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        'display': '-0.03em',
        'heading': '-0.02em',
      },
      fontSize: {
        'xs': '12px',
        'sm': '13px',
        'base': '15px',
        'lg': '17px',
        'xl': '18px',
        '2xl': '20px',
        '3xl': '28px',
        '4xl': '42px',
      },
      borderRadius: {
        'sm': '10px',
        'md': '16px',
        'lg': '20px',
        'xl': '24px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'soft-xl': '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
      spacing: {
        '72': '18rem',
        '80': '20rem',
        '96': '24rem',
      },
    },
  },
  plugins: [],
}
