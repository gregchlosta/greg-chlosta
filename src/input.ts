type Action = 'up' | 'down' | 'left' | 'right' | 'jump';

const KEYS: Record<string, Action> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
};

export class Input {
  enabled = true;
  private held = new Set<Action>();
  private jumpQueued = false;

  constructor() {
    addEventListener('keydown', (e) => {
      const action = KEYS[e.code];
      if (!action || !this.enabled || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Let Space activate a focused button or link instead of hopping.
      if (action === 'jump' && (tag === 'BUTTON' || tag === 'A')) return;
      e.preventDefault();
      if (action === 'jump') {
        if (!e.repeat) this.jumpQueued = true;
      } else {
        this.held.add(action);
      }
    });
    addEventListener('keyup', (e) => {
      const action = KEYS[e.code];
      if (action) this.held.delete(action);
    });
    addEventListener('blur', () => this.held.clear());
  }

  get throttle() {
    return (this.held.has('up') ? 1 : 0) - (this.held.has('down') ? 1 : 0);
  }

  get steer() {
    return (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
  }

  queueJump() {
    this.jumpQueued = true;
  }

  consumeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }
}
