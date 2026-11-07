/**
 * HERTZ — движение.
 *
 * Один сценарий: маска HERTZ, лёгкий параллакс фона, последовательное появление
 * секций и закрывающего слова. Всё отключается при prefers-reduced-motion.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initMotion() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const hero = document.querySelector<HTMLElement>('.hero');
  const heroWord = document.querySelector<HTMLElement>('.hero__word');
  const heroImage = document.querySelector<HTMLElement>('.hero__image');
  const footerWord = document.querySelector<HTMLElement>('.footer__word');

  if (heroWord) {
    const intro = gsap.timeline({
      defaults: { ease: 'expo.out' },
      delay: 0.08,
    });
    intro.to(heroWord, {
      y: 0,
      yPercent: 0,
      duration: 1.35,
    });

    intro.from(
      '.site-header__inner',
      {
        y: -18,
        autoAlpha: 0,
        duration: 0.8,
      },
      0.18,
    );

    intro.from(
      '[data-intro]',
      {
        y: 22,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.09,
      },
      0.32,
    );

  }

  if (hero && heroImage) {
    gsap.to(heroImage, {
      yPercent: 9,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  }

  const services = gsap.utils.toArray<HTMLElement>('.service');
  services.forEach((card, index) => {
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.95,
      delay: index * 0.11,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.services__grid',
        start: 'top 82%',
        once: true,
      },
    });
  });

  const reveals = gsap.utils
    .toArray<HTMLElement>('[data-reveal]')
    .filter((element) => !element.classList.contains('service'));

  reveals.forEach((element) => {
    gsap.to(element, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 89%',
        once: true,
      },
    });
  });

  if (footerWord) {
    gsap.to(footerWord, {
      y: 0,
      yPercent: 0,
      duration: 1.35,
      ease: 'expo.out',
      scrollTrigger: {
        trigger: '.footer',
        start: 'top 78%',
        once: true,
      },
    });
  }

  const refresh = () => ScrollTrigger.refresh();
  if (document.readyState === 'complete') refresh();
  else window.addEventListener('load', refresh, { once: true });
}
