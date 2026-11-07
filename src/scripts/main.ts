/**
 * Единая точка входа клиентских сценариев.
 * Секции не импортируют скрипты сами — порядок инициализации задан здесь.
 */
import { initMotion } from './motion';
import { initPricingQuiz } from './pricing';
import { initVisualizer } from './visualizer';

const boot = () => {
  initVisualizer();
  initMotion();
  initPricingQuiz();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
