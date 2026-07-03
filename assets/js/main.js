// Global main JavaScript
// Initialize Lucide icons when DOM is ready
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

// ─ Cookie Consent Banner ─
function initCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  if (!banner) return;

  const dismissBtn = banner.querySelector('[data-dismiss-cookies]');
  if (!dismissBtn) return;

  // Check if user has already dismissed
  if (localStorage.getItem('cookies-accepted')) {
    banner.style.display = 'none';
    return;
  }

  dismissBtn.addEventListener('click', () => {
    localStorage.setItem('cookies-accepted', 'true');
    banner.style.display = 'none';
  });
}

// ─ Mobile Nav (Alpine.js handles this, but fallback) ─
// Alpine auto-handles x-data directives, so no extra JS needed here

// ─ Initialize on page load ─
document.addEventListener('DOMContentLoaded', () => {
  initCookieBanner();

  // Re-render Lucide icons after includes load
  if (typeof lucide !== 'undefined') {
    setTimeout(() => lucide.createIcons(), 100);
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
