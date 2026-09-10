/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        /* ─ Theme-able tokens — actual values live as CSS vars in input.css,
           swapped per [data-theme] so pages never need to change. ─ */
        'navy': 'rgb(var(--color-navy-rgb) / <alpha-value>)',
        'navy-deep': 'var(--color-navy-deep)',
        'navy-tint': 'var(--color-navy-tint)',
        'slate-blue': 'var(--color-slate-blue)',
        'slate-tint': 'var(--color-slate-tint)',
        'gold': 'var(--color-gold)',
        'gold-tint': 'var(--color-gold-tint)',
        'gold-deep': 'var(--color-gold-deep)',
        'gold-text': 'var(--color-gold-text)',
        'terra': 'var(--color-terra)',
        'terra-tint': 'var(--color-terra-tint)',
        'cream': 'var(--color-cream)',
        'tan': 'var(--color-tan)',
        'tan-tint': 'var(--color-tan-tint)',

        /* ─ Legacy token names, remapped onto the same vars as their canonical
           counterparts above. Kept so existing markup keeps rendering. ─ */
        'primary-blue': 'rgb(var(--color-navy-rgb) / <alpha-value>)',
        'primary-blue-light': 'var(--color-navy-tint)',
        'primary-blue-mid': 'var(--color-slate-blue)',
        'accent-amber': 'var(--color-gold)',
        'accent-amber-light': 'var(--color-gold-tint)',
        'accent-teal': 'var(--color-slate-blue)',
        'accent-teal-light': 'var(--color-slate-tint)',
        'success-green': 'var(--color-success-green)',
        'success-green-light': 'var(--color-success-green-light)',
        'error-red': 'var(--color-terra)',
        'error-red-light': 'var(--color-terra-tint)',
        'gray-50-custom': 'var(--color-gray-50)',
        'gray-100-custom': 'var(--color-gray-100)',
        'gray-200-custom': 'var(--color-gray-200)',
        'gray-400-custom': 'var(--color-gray-400)',
        'gray-600-custom': 'var(--color-gray-600)',
        'gray-800-custom': 'var(--color-gray-800)',
        'gray-900-custom': 'var(--color-gray-900)',
        'bg-warm': 'var(--color-bg-warm)',
      },
      fontFamily: {
        'sans': 'var(--font-sans)',
        /* Headings use the same family at heavier weights — see input.css */
        'serif': 'var(--font-sans)',
      },
      letterSpacing: {
        'display': 'var(--tracking-display)',
        'heading': 'var(--tracking-heading)',
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
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'soft-lg': 'var(--shadow-soft-lg)',
        'soft-xl': 'var(--shadow-soft-xl)',
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
