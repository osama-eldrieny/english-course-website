// Include HTML partials (header/footer) into pages
async function includeHTML() {
  const elements = document.querySelectorAll('[data-include]');

  for (const element of elements) {
    const file = element.getAttribute('data-include');
    try {
      const response = await fetch(file);
      if (response.ok) {
        element.innerHTML = await response.text();
      } else {
        element.innerHTML = '<p>Error loading content</p>';
      }
    } catch (error) {
      console.error(`Error loading ${file}:`, error);
      element.innerHTML = '<p>Error loading content</p>';
    }
  }

  // Re-initialize Lucide icons after includes are loaded
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Dispatch custom event so main.js knows includes are done
  document.dispatchEvent(new CustomEvent('includesLoaded'));
}

// Call on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', includeHTML);
} else {
  includeHTML();
}
