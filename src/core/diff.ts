import type { Divergence } from './types';

const IGNORED_ATTRIBUTES = new Set<string>(['data-reactroot']);

/**
 * Parse captured server markup into a detached document, so re-materializing it
 * for the diff never fetches the images, iframes or media it references.
 * `rootTagName` preserves the HTML parsing context (e.g. rows in a `<tbody>`).
 */
export function parseServerHtml(html: string, rootTagName: string): Element {
  const doc = document.implementation.createHTMLDocument('');
  const container = doc.createElement(rootTagName || 'div');
  container.innerHTML = html;
  return container;
}

/**
 * Collect *every* divergence between the server snapshot and the live DOM, in a
 * deterministic order, deduped-by-value upstream. Children are aligned with an
 * LCS (by tag+id) so a node the client injects mid-tree (a portal, toast, ad,
 * or Suspense-resolved subtree) is treated as an insertion instead of shifting
 * every sibling and cascading into false positives.
 */
export function collectDivergences(
  serverRoot: Element,
  clientRoot: Element,
  limit = 60,
): Divergence[] {
  const out: Divergence[] = [];
  collectChildren(serverRoot, clientRoot, tagPath(clientRoot), out, limit);
  return out;
}

export function collectSnapshotAgainstDom(
  serverHtml: string,
  clientRoot: Element,
  limit = 60,
): Divergence[] {
  const serverRoot = parseServerHtml(serverHtml, clientRoot.tagName);
  return collectDivergences(serverRoot, clientRoot, limit);
}

// Back-compat single-divergence helpers (used by tests / message-less paths).
export function diffTrees(
  serverRoot: Element,
  clientRoot: Element,
): Divergence | null {
  return collectDivergences(serverRoot, clientRoot, 1)[0] ?? null;
}

export function diffSnapshotAgainstDom(
  serverHtml: string,
  clientRoot: Element,
): Divergence | null {
  return collectSnapshotAgainstDom(serverHtml, clientRoot, 1)[0] ?? null;
}

function collectChildren(
  serverParent: Node,
  clientParent: Node,
  parentPath: string,
  out: Divergence[],
  limit: number,
): void {
  if (out.length >= limit) return;
  const serverChildren = meaningfulChildNodes(serverParent);
  const clientChildren = meaningfulChildNodes(clientParent);
  const parentPending = hasPendingSuspense(serverParent);
  const parentTag = elementTag(clientParent);
  const pairs = alignChildren(serverChildren, clientChildren);

  let index = 0;
  for (let k = 0; k < pairs.length; k++) {
    if (out.length >= limit) return;
    const [serverNode, clientNode] = pairs[k]!;

    // Coalesce an adjacent delete+insert into one `structure` swap (e.g. server
    // <b>, client <i> at the same slot), so one logical change isn't two reports.
    if (serverNode && !clientNode && k + 1 < pairs.length) {
      const [nextServer, nextClient] = pairs[k + 1]!;
      if (!nextServer && nextClient && !isInjectedContainer(nextClient)) {
        const path = childPath(parentPath, nextClient, index);
        index += 1;
        k += 1;
        out.push({
          kind: 'structure',
          path,
          tagName: elementTag(nextClient),
          parentTagName: parentTag,
          server: serialize(serverNode),
          client: serialize(nextClient),
          element: asElement(nextClient),
        });
        continue;
      }
    }

    const anchor = clientNode ?? serverNode;
    if (!anchor) continue;
    const path = childPath(parentPath, anchor, index);
    index += 1;

    if (serverNode && !clientNode) {
      // Server rendered a node the client dropped — a real structural mismatch.
      out.push({
        kind: 'node-removed',
        path,
        tagName: elementTag(serverNode),
        parentTagName: parentTag,
        server: serialize(serverNode),
        client: null,
        element: asElement(clientParent),
      });
    } else if (!serverNode && clientNode) {
      // Client rendered an extra node. Skip injections (portals, toasts, ads,
      // modals) and Suspense-resolved content — those are not the dev's bug.
      if (isInjectedContainer(clientNode)) continue;
      if (clientNode.nodeType === Node.ELEMENT_NODE && parentPending) continue;
      out.push({
        kind: 'node-added',
        path,
        tagName: elementTag(clientNode),
        parentTagName: parentTag,
        server: null,
        client: serialize(clientNode),
        element: asElement(clientNode),
      });
    } else if (serverNode && clientNode) {
      collectNode(serverNode, clientNode, path, parentTag, out, limit);
    }
  }
}

function collectNode(
  serverNode: Node,
  clientNode: Node,
  path: string,
  parentTag: string | undefined,
  out: Divergence[],
  limit: number,
): void {
  if (serverNode.nodeType !== clientNode.nodeType) {
    out.push({
      kind: 'structure',
      path,
      tagName: elementTag(clientNode),
      parentTagName: parentTag,
      server: serialize(serverNode),
      client: serialize(clientNode),
      element: asElement(clientNode),
    });
    return;
  }

  if (
    serverNode.nodeType === Node.TEXT_NODE ||
    serverNode.nodeType === Node.COMMENT_NODE
  ) {
    const serverText = serverNode.textContent ?? '';
    const clientText = clientNode.textContent ?? '';
    if (serverText !== clientText) {
      out.push({
        kind: 'text',
        path,
        parentTagName: parentTag,
        server: serverText,
        client: clientText,
        element: asElement(clientNode.parentNode),
      });
    }
    return;
  }

  if (serverNode.nodeType === Node.ELEMENT_NODE) {
    const serverEl = serverNode as Element;
    const clientEl = clientNode as Element;

    if (serverEl.tagName !== clientEl.tagName) {
      out.push({
        kind: 'structure',
        path,
        tagName: clientEl.tagName,
        parentTagName: parentTag,
        server: serialize(serverEl),
        client: serialize(clientEl),
        element: clientEl,
      });
      return;
    }

    const attrDivergence = diffAttributes(serverEl, clientEl, path, parentTag);
    if (attrDivergence) out.push(attrDivergence);

    collectChildren(serverEl, clientEl, path, out, limit);
  }
}

function diffAttributes(
  serverEl: Element,
  clientEl: Element,
  path: string,
  parentTag: string | undefined,
): Divergence | null {
  const names = new Set<string>();
  for (const a of Array.from(serverEl.attributes)) names.add(a.name);
  for (const a of Array.from(clientEl.attributes)) names.add(a.name);

  for (const name of names) {
    if (IGNORED_ATTRIBUTES.has(name)) continue;
    const serverValue = serverEl.getAttribute(name);
    const clientValue = clientEl.getAttribute(name);
    if (normalizeAttr(name, serverValue) === normalizeAttr(name, clientValue)) {
      continue;
    }
    return {
      kind: 'attribute',
      path,
      tagName: clientEl.tagName,
      parentTagName: parentTag,
      attribute: name,
      server: serverValue,
      client: clientValue,
      element: clientEl,
    };
  }
  return null;
}

function normalizeAttr(name: string, value: string | null): string | null {
  if (value == null) return null;
  if (name === 'class') {
    return value.trim().split(/\s+/).filter(Boolean).sort().join(' ');
  }
  if (name === 'style') {
    return normalizeStyle(value);
  }
  return value;
}

// Canonicalize an inline style through the CSSOM so React's raw serialization
// (`color:#0f172a`) compares equal to the browser-normalized live value
// (`color: rgb(15, 23, 42);`), order-independent.
function normalizeStyle(value: string): string {
  if (typeof document !== 'undefined') {
    try {
      const el = document.createElement('div');
      el.style.cssText = value;
      const decls: string[] = [];
      for (let i = 0; i < el.style.length; i++) {
        const prop = el.style.item(i);
        decls.push(`${prop}:${el.style.getPropertyValue(prop)}`);
      }
      return decls.sort().join(';');
    } catch {
      /* fall through to string normalization */
    }
  }
  return value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(';');
}

// ---- alignment ------------------------------------------------------------

function nodeKey(node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    return el.id ? `${el.tagName}#${el.id}` : el.tagName;
  }
  if (node.nodeType === Node.TEXT_NODE) return '#text';
  return '#other';
}

// Align two child lists by an LCS on their keys, so inserted/removed nodes are
// identified rather than shifting the whole comparison. Falls back to index
// pairing for very large lists (keeps it O(n) there).
function alignChildren(
  server: Node[],
  client: Node[],
): Array<[Node | null, Node | null]> {
  const m = server.length;
  const n = client.length;
  if (m === 0 || n === 0 || m > 200 || n > 200 || m * n > 10000) {
    const pairs: Array<[Node | null, Node | null]> = [];
    const max = Math.max(m, n);
    for (let i = 0; i < max; i++) {
      pairs.push([server[i] ?? null, client[i] ?? null]);
    }
    return pairs;
  }
  const sk = server.map(nodeKey);
  const ck = client.map(nodeKey);
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] =
        sk[i] === ck[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const pairs: Array<[Node | null, Node | null]> = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (sk[i] === ck[j]) {
      pairs.push([server[i]!, client[j]!]);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      pairs.push([server[i]!, null]);
      i++;
    } else {
      pairs.push([null, client[j]!]);
      j++;
    }
  }
  while (i < m) pairs.push([server[i++]!, null]);
  while (j < n) pairs.push([null, client[j++]!]);
  return pairs;
}

// ---- noise / injection / suspense ----------------------------------------

const NOISE_TAGS = new Set<string>([
  'SCRIPT',
  'STYLE',
  'LINK',
  'TEMPLATE',
  'NOSCRIPT',
]);

const TRACKER_MARKER =
  /googlefc|adsbygoogle|google_ads|googletag|__tcfapi|onetrust|optanon|cookiebot|usercentrics|didomi|quantcast|grammarly|gtm|hotjar|fullstory|intercom|drift|zendesk|livechat|tawk|hubspot|turnstile|recaptcha/i;

// Elements client-side scripts/libraries mount that the server never rendered:
// toasts, modals, portals, overlays, tooltips, consent banners, chat widgets.
const INJECTED_MARKER =
  /toastify|toast|modal|portal|overlay|backdrop|drawer|dialog|popover|popper|tooltip|snackbar|notification|consent|gdpr|cookie-?(?:banner|consent)|intercom|drift|crisp|tawk|zendesk|onetrust|usercentrics/i;

function isThirdPartyNoiseElement(el: Element): boolean {
  const identity = `${el.getAttribute('name') ?? ''} ${el.id} ${
    typeof el.className === 'string' ? el.className : ''
  }`;
  if (TRACKER_MARKER.test(identity)) return true;
  if (el.tagName === 'IFRAME') {
    const src = el.getAttribute('src') ?? '';
    const style = (el.getAttribute('style') ?? '').toLowerCase();
    const hidden =
      /display\s*:\s*none/.test(style) ||
      /visibility\s*:\s*hidden/.test(style) ||
      /(?:left|top)\s*:\s*-\d{3,}px/.test(style) ||
      /(?:width|height)\s*:\s*0(?:px)?\b/.test(style) ||
      el.hasAttribute('hidden') ||
      el.getAttribute('aria-hidden') === 'true';
    if (src === 'about:blank' || hidden) return true;
  }
  return false;
}

// A client-only node that is a portal / toast / overlay / third-party widget —
// never part of the app's hydration, so it must not be reported.
function isInjectedContainer(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  if (isNoiseElement(el)) return true;
  const cls = typeof el.className === 'string' ? el.className : '';
  if (INJECTED_MARKER.test(`${el.id} ${cls}`)) return true;
  if (el.hasAttribute('aria-live')) return true;
  const role = el.getAttribute('role');
  if (role && /^(dialog|alertdialog|tooltip|status|alert)$/.test(role.trim())) {
    return true;
  }
  if (el.tagName.includes('-PORTAL') || el.tagName.includes('-OVERLAY')) {
    return true;
  }
  for (const attr of Array.from(el.attributes)) {
    if (/portal|radix|headlessui|floating-ui/i.test(attr.name)) return true;
  }
  return false;
}

function isNoiseElement(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  if (el.hasAttribute('data-why-hydration')) return true;
  if (NOISE_TAGS.has(el.tagName)) return true;
  if (el.tagName.includes('-ROUTE-ANNOUNCER')) return true;
  if (isThirdPartyNoiseElement(el)) return true;
  return false;
}

// True when a parent's server children include a *pending* Suspense boundary
// (`<!--$?-->`), i.e. the server streamed a fallback that the client resolves to
// different content. Those differences are expected, not bugs.
function hasPendingSuspense(parent: Node): boolean {
  for (const n of Array.from(parent.childNodes)) {
    if (n.nodeType === Node.COMMENT_NODE && (n.nodeValue ?? '').startsWith('$?')) {
      return true;
    }
  }
  return false;
}

function meaningfulChildNodes(parent: Node): Node[] {
  const raw = Array.from(parent.childNodes);
  const hasElement = raw.some(
    (n) => n.nodeType === Node.ELEMENT_NODE && !isNoiseElement(n),
  );
  const result: Node[] = [];
  const boundaryStack: string[] = [];
  for (const node of raw) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const data = node.nodeValue ?? '';
      if (data === '$?' || data === '$' || data === '$!') boundaryStack.push(data);
      else if (data === '/$') boundaryStack.pop();
      continue; // React/RSC markers are never real content.
    }
    // Skip fallback content inside a pending Suspense boundary.
    if (boundaryStack.includes('$?')) continue;
    if (isNoiseElement(node)) continue;
    if (node.nodeType !== Node.TEXT_NODE) {
      result.push(node);
      continue;
    }
    const text = node.textContent ?? '';
    if (text.trim() !== '' || !hasElement) result.push(node);
  }
  return result;
}

function serialize(node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as Element).outerHTML;
  }
  return node.textContent ?? '';
}

function asElement(node: Node | null | undefined): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : null;
}

function elementTag(node: Node): string | undefined {
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element).tagName
    : undefined;
}

function tagPath(el: Element): string {
  return el.tagName.toLowerCase();
}

function childPath(parentPath: string, node: Node, index: number): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    return `${parentPath} > ${tag}${id}:nth-child(${index + 1})`;
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return `${parentPath} > #comment[${index}]`;
  }
  return `${parentPath} > #text[${index}]`;
}
