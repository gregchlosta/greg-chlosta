import './style.css';
import { UI } from './ui';

const ui = new UI(document.getElementById('ui')!);

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function fallback() {
  document.body.classList.add('no-webgl');
  ui.showClassic(false);
}

// three.js is most of the bundle, so load it after the intro has painted.
if (hasWebGL()) import('./valley').then((m) => m.startValley(ui), fallback);
else fallback();
