// GSAP ScrollTrigger animations and utilities

// ─ Scroll Reveal Helper ─
function revealOnScroll(selector, stagger = 0.1) {
  if (!gsap.utils.selector) return;

  const elements = gsap.utils.toArray(selector);

  elements.forEach((element, i) => {
    gsap.fromTo(
      element,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        delay: i * stagger,
        scrollTrigger: {
          trigger: element,
          start: 'top 80%',
          markers: false,
        },
      }
    );
  });
}

// ─ Counter Animation Helper ─
function animateCounter(selector, endValue, duration = 2) {
  gsap.utils.toArray(selector).forEach((element) => {
    const startValue = 0;

    gsap.to(
      { value: startValue },
      {
        value: endValue,
        duration: duration,
        onUpdate: function() {
          element.textContent = Math.floor(this.targets()[0].value).toLocaleString();
        },
        scrollTrigger: {
          trigger: element,
          start: 'top 80%',
          markers: false,
        },
      }
    );
  });
}

// ─ Stagger Fade-In on Scroll ─
function staggerFadeIn(selector, config = {}) {
  const defaults = {
    stagger: 0.1,
    duration: 0.6,
    startTrigger: 'top 85%',
  };
  const options = { ...defaults, ...config };

  const elements = gsap.utils.toArray(selector);

  gsap.to(elements, {
    opacity: 1,
    y: 0,
    duration: options.duration,
    stagger: options.stagger,
    scrollTrigger: {
      trigger: elements[0],
      start: options.startTrigger,
      markers: false,
    },
  });
}

// ─ Parallax Hero ─
function parallaxHero(selector, strength = 0.5) {
  gsap.to(selector, {
    y: (i, target) => -window.innerHeight * strength,
    scrollTrigger: {
      trigger: target,
      start: 'top top',
      end: 'bottom top',
      scrub: 1,
      markers: false,
    },
  });
}

// ─ Respects prefers-reduced-motion ─
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion) {
  // Disable GSAP animations
  gsap.config({ nullTargetWarn: false });
  gsap.globalTimeline.timeScale(0);
}
