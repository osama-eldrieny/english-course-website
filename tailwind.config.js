/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#1a5c9a',
        'primary-blue-light': '#e8f2fc',
        'primary-blue-mid': '#4a90d9',
        'accent-amber': '#f4a62a',
        'accent-amber-light': '#fef6e8',
        'success-green': '#1e8a5c',
        'success-green-light': '#e7f7f0',
        'error-red': '#c0392b',
        'error-red-light': '#fdf0ee',
        'gray-50-custom': '#f8f9fa',
        'gray-100-custom': '#f1f3f4',
        'gray-200-custom': '#e8eaed',
        'gray-400-custom': '#9aa0a6',
        'gray-600-custom': '#5f6368',
        'gray-800-custom': '#3c4043',
        'gray-900-custom': '#202124',
        'bg-warm': '#FEFCF8',
      },
      fontFamily: {
        'serif': ['"DM Serif Display"', 'serif'],
        'sans': ['"Plus Jakarta Sans"', 'sans-serif'],
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
