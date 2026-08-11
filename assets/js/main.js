// Global main JavaScript
// Initialize Lucide icons when DOM is ready
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

// ─ Mobile Nav (Alpine.js handles this, but fallback) ─
// Alpine auto-handles x-data directives, so no extra JS needed here

// ─ Initialize on page load ─
document.addEventListener('DOMContentLoaded', () => {
  // Re-render Lucide icons after includes load
  if (typeof lucide !== 'undefined') {
    setTimeout(() => lucide.createIcons(), 100);
  }
});

// Listen for includes to finish loading
document.addEventListener('includesLoaded', () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// ─ Smooth scroll for anchor links ─
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();
    // Offset by the sticky header so the target isn't hidden behind it
    const offset = 96;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    history.replaceState(null, '', href);
  });
});
