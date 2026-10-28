import { contactLinks, profile, stations, type IconName, type Link, type Station } from './content';

const ICONS: Record<IconName | 'arrow' | 'close', string> = {
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.5c0-1.3-.02-3-1.83-3-1.83 0-2.1 1.43-2.1 2.9V21h-4V9Z"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

function linkHtml(l: Link) {
  const external = l.href.startsWith('http');
  return `<a class="link" href="${l.href}"${external ? ' target="_blank" rel="noopener"' : ''}>${ICONS[l.icon]}<span>${l.label}</span></a>`;
}

export interface CardInfo {
  discovered: number;
  next: { index: number; label: string } | null;
}

export interface UIHandlers {
  start(): void;
  travel(index: number): void;
  closeCard(): void;
  openContact(): void;
  hop(): void;
  classicChanged(open: boolean): void;
}

const touch = matchMedia('(pointer: coarse)').matches;

export class UI {
  handlers: UIHandlers = { start() {}, travel() {}, closeCard() {}, openContact() {}, hop() {}, classicChanged() {} };
  classicOpen = false;
  cardOpen = false;

  private readonly card: HTMLElement;
  private readonly classic: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly progressText: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly dots: HTMLElement[];
  private canLeaveClassic = true;
  private toastTimer = 0;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = this.template();
    const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
    this.card = $('.card');
    this.classic = $('.classic');
    this.hint = $('.hint');
    this.progressText = $('.progress-text');
    this.toastEl = $('.toast');
    this.dots = [...root.querySelectorAll<HTMLElement>('.dot')];

    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!el) return;
      switch (el.dataset.action) {
        case 'start':
          this.handlers.start();
          break;
        case 'classic':
          this.showClassic(true);
          break;
        case 'back':
          this.hideClassic();
          break;
        case 'contact':
          this.handlers.openContact();
          break;
        case 'close-card':
          this.handlers.closeCard();
          break;
        case 'travel':
          this.handlers.travel(Number(el.dataset.index));
          break;
        case 'hop':
          this.handlers.hop();
          break;
      }
      // Drop focus so the keyboard keeps steering the bike.
      if (el instanceof HTMLButtonElement) el.blur();
    });

    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.classicOpen && this.canLeaveClassic) this.hideClassic();
      else if (this.cardOpen) this.handlers.closeCard();
    });
  }

  private template() {
    const year = new Date().getFullYear();
    const keys = touch
      ? 'Tap anywhere to ride there · tap a label to visit a stop'
      : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to ride · <kbd>Space</kbd> to hop · or click anywhere';
    return `
      <section class="intro" aria-labelledby="intro-title">
        <div class="intro-inner">
          <p class="eyebrow">Hi, I'm</p>
          <h1 id="intro-title">${profile.name}</h1>
          <p class="lead">Staff software engineer who loves <strong>AI</strong> and fixing anything with an engine, a hinge or a bug.</p>
          <p class="sub">Hop on the bike and visit ${stations.length} stops around the valley to get to know me.</p>
          <div class="intro-actions">
            <button class="btn primary" data-action="start">Start riding ${ICONS.arrow}</button>
            <button class="btn ghost" data-action="classic">Just show me the info</button>
          </div>
          <p class="keys">${keys}</p>
        </div>
      </section>

      <header class="hud hud-top">
        <div class="brand">
          <span class="brand-name">${profile.name}</span>
          <span class="brand-sub">AI · Software · Fixer of things · ${profile.location.split(',')[0]}</span>
        </div>
        <nav class="hud-actions">
          <button class="chip" data-action="contact">Contact</button>
          <button class="chip" data-action="classic">Classic view</button>
        </nav>
      </header>

      <div class="hud progress" role="group" aria-label="Stops discovered">
        <div class="dots">
          ${stations
            .map(
              (s, i) =>
                `<button class="dot" data-action="travel" data-index="${i}" style="--c:${s.color}" title="Ride to ${s.label}" aria-label="Ride to ${s.label}"></button>`,
            )
            .join('')}
        </div>
        <span class="progress-text">0 / ${stations.length} discovered</span>
      </div>

      <p class="hud hint">${keys}</p>
      ${touch ? `<button class="hud hop" data-action="hop" aria-label="Hop">Hop</button>` : ''}

      <aside class="card" role="dialog" aria-modal="false" aria-hidden="true" aria-labelledby="card-title"></aside>
      <div class="toast" role="status" aria-live="polite"></div>
      <section class="classic" hidden>${this.classicTemplate(year)}</section>
    `;
  }

  private classicTemplate(year: number) {
    return `
      <div class="classic-inner">
        <button class="btn ghost back" data-action="back">← Back to the 3D valley</button>
        <header class="classic-head">
          <p class="eyebrow">${profile.location}</p>
          <h1>${profile.name}</h1>
          <p class="lead">${profile.headline}</p>
          <p class="intro-text">${profile.intro}</p>
          <div class="links">${contactLinks.map(linkHtml).join('')}</div>
        </header>
        <div class="grid">
          ${stations
            .filter((s) => s.id !== 'contact')
            .map(
              (s) => `
            <article class="tile" style="--c:${s.color}">
              <p class="tag">${s.tag}</p>
              <h2>${s.title}</h2>
              <ul>${s.facts.map((f) => `<li>${f}</li>`).join('')}</ul>
            </article>`,
            )
            .join('')}
        </div>
        <footer class="classic-foot">
          <h2>Let's talk</h2>
          <div class="links">${contactLinks.map(linkHtml).join('')}</div>
          <p class="fine">© ${year} ${profile.name} · Calgary, Alberta</p>
        </footer>
      </div>`;
  }

  hideIntro() {
    document.body.classList.add('playing');
  }

  openCard(s: Station, index: number, info: CardInfo) {
    this.cardOpen = true;
    document.body.classList.add('card-open');
    this.card.style.setProperty('--c', s.color);
    this.card.innerHTML = `
      <button class="card-close" data-action="close-card" aria-label="Close">${ICONS.close}</button>
      <p class="tag"><span class="tag-dot"></span>${s.tag} <span class="tag-count">${index + 1} / ${stations.length}</span></p>
      <h2 id="card-title">${s.title}</h2>
      <ul class="facts">${s.facts.map((f) => `<li>${f}</li>`).join('')}</ul>
      ${s.links ? `<div class="links">${s.links.map(linkHtml).join('')}</div>` : ''}
      ${
        info.next
          ? `<button class="next" data-action="travel" data-index="${info.next.index}">Next stop: ${info.next.label} ${ICONS.arrow}</button>`
          : ''
      }`;
    this.card.setAttribute('aria-hidden', 'false');
    this.card.classList.remove('show');
    void this.card.offsetWidth; // restart the entrance animation
    this.card.classList.add('show');
  }

  closeCard() {
    this.cardOpen = false;
    document.body.classList.remove('card-open');
    this.card.classList.remove('show');
    this.card.setAttribute('aria-hidden', 'true');
  }

  setProgress(discovered: boolean[]) {
    const n = discovered.filter(Boolean).length;
    discovered.forEach((d, i) => this.dots[i].classList.toggle('done', d));
    this.progressText.textContent = n === stations.length ? 'All stops discovered!' : `${n} / ${stations.length} discovered`;
  }

  hideHint() {
    this.hint.classList.add('gone');
  }

  showClassic(canLeave: boolean) {
    this.canLeaveClassic = canLeave;
    this.classic.hidden = false;
    this.classic.querySelector<HTMLElement>('.back')!.hidden = !canLeave;
    this.classic.scrollTop = 0;
    this.classicOpen = true;
    this.handlers.classicChanged(true);
  }

  hideClassic() {
    this.classic.hidden = true;
    this.classicOpen = false;
    this.handlers.classicChanged(false);
  }

  toast(html: string, ms = 5000) {
    this.toastEl.innerHTML = html;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'confetti';
    const colors = stations.map((s) => s.color);
    for (let i = 0; i < 110; i++) {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.6}s`;
      piece.style.animationDuration = `${2.4 + Math.random() * 1.8}s`;
      piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 240}px`);
      piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
      layer.appendChild(piece);
    }
    this.root.appendChild(layer);
    setTimeout(() => layer.remove(), 5000);
  }
}
