import type { HydrationReport } from '../core/types';

export interface OverlayOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export interface OverlayHandle {
  push: (report: HydrationReport) => void;
  destroy: () => void;
}

const CONTAINER_ID = 'why-hydration-overlay';

const CATEGORY_LABELS: Record<string, string> = {
  'non-deterministic-value': 'Non-deterministic value',
  'date-time': 'Date / time',
  'locale-format': 'Locale formatting',
  'browser-only-api': 'Browser-only API',
  'viewport-branching': 'Viewport branching',
  'invalid-html-nesting': 'Invalid HTML nesting',
  'whitespace-minification': 'Whitespace / minification',
  'third-party-dom-mutation': 'Third-party DOM mutation',
  unknown: 'Unknown',
};

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.wh-panel {
  position: fixed;
  z-index: 2147483647;
  width: min(420px, calc(100vw - 32px));
  max-height: min(70vh, 640px);
  display: flex;
  flex-direction: column;
  font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #e5e7eb;
  background: #0b0f17;
  border: 1px solid #1f2937;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.5);
  overflow: hidden;
}
.wh-bottom-right { bottom: 16px; right: 16px; }
.wh-bottom-left  { bottom: 16px; left: 16px; }
.wh-top-right    { top: 16px; right: 16px; }
.wh-top-left     { top: 16px; left: 16px; }
.wh-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(180deg, #151b26, #0d1220);
  border-bottom: 1px solid #1f2937;
}
.wh-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex: none; }
.wh-title { font-weight: 600; color: #f3f4f6; }
.wh-count {
  margin-left: auto; font-size: 11px; color: #9ca3af;
  background: #111827; border: 1px solid #1f2937; border-radius: 999px;
  padding: 1px 8px;
}
.wh-btn {
  appearance: none; border: 1px solid #1f2937; background: #111827;
  color: #9ca3af; border-radius: 6px; cursor: pointer;
  font-size: 12px; padding: 3px 8px;
}
.wh-btn:hover { color: #f3f4f6; border-color: #374151; }
.wh-list { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.wh-card { border: 1px solid #1f2937; border-radius: 10px; background: #0f1521; overflow: hidden; }
.wh-card-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; }
.wh-cat {
  font-weight: 600; color: #fbbf24; font-size: 12px;
}
.wh-conf { margin-left: auto; font-size: 11px; color: #6b7280; }
.wh-body { padding: 0 10px 10px; }
.wh-where { font-size: 11px; color: #9ca3af; word-break: break-all; margin-bottom: 8px; }
.wh-where code { color: #93c5fd; }
.wh-diff { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
.wh-side { border-radius: 8px; padding: 6px 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; word-break: break-word; }
.wh-server { background: rgba(244,63,94,.08); border: 1px solid rgba(244,63,94,.35); }
.wh-client { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.35); }
.wh-side .wh-label { display: block; font-family: inherit; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 3px; }
.wh-server .wh-label { color: #fb7185; }
.wh-client .wh-label { color: #4ade80; }
.wh-explain { color: #cbd5e1; margin-bottom: 8px; }
.wh-fix { color: #e5e7eb; background: #111827; border-left: 3px solid #22c55e; border-radius: 4px; padding: 6px 8px; }
.wh-fix strong { color: #86efac; }
.wh-docs { display: inline-block; margin-top: 6px; color: #60a5fa; text-decoration: none; font-size: 11px; }
.wh-docs:hover { text-decoration: underline; }
.wh-empty-value { color: #6b7280; font-style: italic; }
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderValue(value: string | null): HTMLElement {
  if (value == null || value === '') {
    return el('span', 'wh-empty-value', value === '' ? '(empty)' : '(none)');
  }
  const span = document.createElement('span');
  span.textContent = value;
  return span;
}

function renderCard(report: HydrationReport): HTMLElement {
  const card = el('div', 'wh-card');

  const head = el('div', 'wh-card-head');
  head.appendChild(
    el('span', 'wh-cat', CATEGORY_LABELS[report.cause.category] ?? 'Mismatch'),
  );
  head.appendChild(
    el('span', 'wh-conf', `${Math.round(report.cause.confidence * 100)}%`),
  );
  card.appendChild(head);

  const body = el('div', 'wh-body');

  const where = el('div', 'wh-where');
  const label = report.component
    ? `${report.component} · `
    : report.node.tagName
      ? `<${report.node.tagName.toLowerCase()}> · `
      : '';
  where.append(label);
  const code = el('code');
  code.textContent = report.node.path;
  where.appendChild(code);
  if (report.node.attribute) {
    where.append(` · @${report.node.attribute}`);
  }
  body.appendChild(where);

  const diff = el('div', 'wh-diff');
  const server = el('div', 'wh-side wh-server');
  server.appendChild(el('span', 'wh-label', 'Server'));
  server.appendChild(renderValue(report.server));
  const client = el('div', 'wh-side wh-client');
  client.appendChild(el('span', 'wh-label', 'Client'));
  client.appendChild(renderValue(report.client));
  diff.appendChild(server);
  diff.appendChild(client);
  body.appendChild(diff);

  body.appendChild(el('div', 'wh-explain', report.cause.explanation));

  const fix = el('div', 'wh-fix');
  const strong = el('strong');
  strong.textContent = 'Fix: ';
  fix.appendChild(strong);
  fix.append(report.cause.suggestion);
  body.appendChild(fix);

  if (report.cause.docsUrl && /^https?:\/\//i.test(report.cause.docsUrl)) {
    const a = el('a', 'wh-docs', 'Learn more →');
    a.href = report.cause.docsUrl;
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    body.appendChild(a);
  }

  card.appendChild(body);
  return card;
}

export function createOverlay(options: OverlayOptions = {}): OverlayHandle {
  const position = options.position ?? 'bottom-right';
  let host: HTMLElement | null = null;
  let listEl: HTMLElement | null = null;
  let countEl: HTMLElement | null = null;
  let count = 0;

  function ensureMounted(): void {
    if (host) return;
    document.getElementById(CONTAINER_ID)?.remove();
    host = document.createElement('div');
    host.id = CONTAINER_ID;
    host.setAttribute('data-why-hydration', 'overlay');
    host.setAttribute('aria-hidden', 'false');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    const panel = el('div', `wh-panel wh-${position}`);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Hydration mismatch diagnostics');

    const header = el('div', 'wh-header');
    header.appendChild(el('span', 'wh-dot'));
    header.appendChild(el('span', 'wh-title', 'Hydration mismatch'));
    countEl = el('span', 'wh-count', '0');
    header.appendChild(countEl);
    const close = el('button', 'wh-btn', 'Dismiss');
    close.setAttribute('aria-label', 'Dismiss diagnostics overlay');
    close.addEventListener('click', () => destroy());
    header.appendChild(close);
    panel.appendChild(header);

    listEl = el('div', 'wh-list');
    panel.appendChild(listEl);

    shadow.appendChild(panel);
    document.body.appendChild(host);

    host.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') destroy();
    });
  }

  function destroy(): void {
    host?.remove();
    host = null;
    listEl = null;
    countEl = null;
  }

  function push(report: HydrationReport): void {
    ensureMounted();
    count += 1;
    if (countEl) countEl.textContent = String(count);
    listEl?.appendChild(renderCard(report));
  }

  return { push, destroy };
}
