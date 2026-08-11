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
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
