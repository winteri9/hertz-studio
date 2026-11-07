/**
 * HERTZ — демо-калькулятор.
 * Ставки приходят из data-атрибутов, отрендеренных из src/data/pricing.ts.
 * Без JS форма остаётся читаемой, а <noscript> показывает ставки.
 */

const NBSP = '\u00A0';

const formatRub = (value: number): string =>
  value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

export function initPricingQuiz() {
  const form = document.querySelector<HTMLFormElement>('[data-pricing-form]');
  const result = document.querySelector<HTMLElement>('[data-price-result]');
  const valueEl = document.querySelector<HTMLElement>('[data-price-value]');
  const detailEl = document.querySelector<HTMLElement>('[data-price-detail]');
  const button = document.querySelector<HTMLButtonElement>('[data-price-submit]');

  if (!form || !result || !valueEl || !detailEl || !button) return;

  const calculate = () => {
    const service = form.querySelector<HTMLInputElement>('input[name="service"]:checked');
    const duration = form.querySelector<HTMLInputElement>('input[name="duration"]:checked');
    if (!service || !duration) return;

    const rate = Number(service.dataset.rate ?? 0);
    const hours = Number(duration.dataset.hours ?? 0);
    const total = rate * hours;
    if (!Number.isFinite(total) || total <= 0) return;

    valueEl.textContent = `${formatRub(total)}${NBSP}₽`;
    detailEl.textContent = `${service.dataset.label ?? 'Сессия'} · ${hours}${NBSP}ч · демо-расчёт`;
  };

  const reveal = () => {
    result.hidden = false;
    requestAnimationFrame(() => result.classList.add('is-visible'));
  };

  button.addEventListener('click', () => {
    calculate();
    reveal();
  });

  form.addEventListener('change', () => {
    if (!result.hidden) calculate();
  });
}
