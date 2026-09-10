// Theme switching: persists choice in localStorage and flips data-theme on <html>.
// The inline snippet in each page's <head> runs this same lookup pre-paint to
// avoid a flash of the wrong theme; this file provides the shared API used by
// the switcher control in the header partial.
const THEME_STORAGE_KEY = 'theme';
const THEMES = [
  { id: 'default', label: 'Theme 1' },
  { id: 'theme2', label: 'Theme 2' },
];

function getTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'default';
  } catch (e) {
    return 'default';
  }
}

function setTheme(id) {
  if (id === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', id);
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch (e) {
    /* storage unavailable — theme still applies for this page view */
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: id } }));
}

window.FluentPathTheme = { THEMES, getTheme, setTheme };
