/**
 * Единая точка входа клиентских сценариев.
 * Секции не импортируют скрипты сами — порядок инициализации задан здесь.
 */
import { initMotion } from './motion';
import { initVisualizer } from './visualizer';

const boot = () => {
  initVisualizer();
  initMotion();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
