import type { Divergence } from './types';

const IGNORED_ATTRIBUTES = new Set<string>(['data-reactroot']);

export function parseServerHtml(html: string, rootTagName: string): Element {
  const container = document.createElement(rootTagName || 'div');
  container.innerHTML = html;
  return container;
}

export function diffTrees(
  serverRoot: Element,
  clientRoot: Element,
  basePath = tagPath(clientRoot),
): Divergence | null {
  return diffChildren(serverRoot, clientRoot, basePath);
}

export function diffSnapshotAgainstDom(
  serverHtml: string,
  clientRoot: Element,
): Divergence | null {
  const serverRoot = parseServerHtml(serverHtml, clientRoot.tagName);
  return diffTrees(serverRoot, clientRoot);
}

function diffChildren(
  serverParent: Node,
  clientParent: Node,
  parentPath: string,
): Divergence | null {
  const serverChildren = meaningfulChildNodes(serverParent);
  const clientChildren = meaningfulChildNodes(clientParent);
  const max = Math.max(serverChildren.length, clientChildren.length);

  for (let i = 0; i < max; i++) {
    const serverNode = serverChildren[i] ?? null;
    const clientNode = clientChildren[i] ?? null;
    const path = childPath(parentPath, (clientNode ?? serverNode) as Node, i);

    if (serverNode && !clientNode) {
      return {
        kind: 'node-removed',
        path,
        tagName: elementTag(serverNode),
        parentTagName: elementTag(clientParent),
        server: serialize(serverNode),
        client: null,
        element: asElement(clientParent),
      };
    }
    if (!serverNode && clientNode) {
      return {
        kind: 'node-added',
        path,
        tagName: elementTag(clientNode),
        parentTagName: elementTag(clientParent),
        server: null,
        client: serialize(clientNode),
        element: asElement(clientNode),
      };
    }
    if (!serverNode || !clientNode) continue;

    const divergence = diffNode(
      serverNode,
      clientNode,
      path,
      elementTag(clientParent),
    );
    if (divergence) return divergence;
  }
  return null;
}

function diffNode(
  serverNode: Node,
  clientNode: Node,
  path: string,
  parentTag: string | undefined,
): Divergence | null {
  if (serverNode.nodeType !== clientNode.nodeType) {
    return {
      kind: 'structure',
      path,
      tagName: elementTag(clientNode),
      parentTagName: parentTag,
      server: serialize(serverNode),
      client: serialize(clientNode),
      element: asElement(clientNode),
    };
  }

  if (
    serverNode.nodeType === Node.TEXT_NODE ||
    serverNode.nodeType === Node.COMMENT_NODE
  ) {
    const serverText = serverNode.textContent ?? '';
    const clientText = clientNode.textContent ?? '';
    if (serverText !== clientText) {
      return {
        kind: 'text',
        path,
        parentTagName: parentTag,
        server: serverText,
        client: clientText,
        element: asElement(clientNode.parentNode),
      };
    }
    return null;
  }

  if (serverNode.nodeType === Node.ELEMENT_NODE) {
    const serverEl = serverNode as Element;
    const clientEl = clientNode as Element;

    if (serverEl.tagName !== clientEl.tagName) {
      return {
        kind: 'structure',
        path,
        tagName: clientEl.tagName,
        parentTagName: parentTag,
        server: serialize(serverEl),
        client: serialize(clientEl),
        element: clientEl,
      };
    }

    const attrDivergence = diffAttributes(serverEl, clientEl, path, parentTag);
    if (attrDivergence) return attrDivergence;

    return diffChildren(serverEl, clientEl, path);
  }

  return null;
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
    return value
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .sort()
      .join(';');
  }
  return value;
}

const NOISE_TAGS = new Set<string>([
  'SCRIPT',
  'STYLE',
  'LINK',
  'TEMPLATE',
  'NOSCRIPT',
]);

function isNoiseElement(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  if (el.hasAttribute('data-why-hydration')) return true;
  if (NOISE_TAGS.has(el.tagName)) return true;
  if (el.tagName.includes('-ROUTE-ANNOUNCER')) return true;
  return false;
}

function meaningfulChildNodes(parent: Node): Node[] {
  const children = Array.from(parent.childNodes);
  const hasElement = children.some(
    (n) => n.nodeType === Node.ELEMENT_NODE && !isNoiseElement(n),
  );
  return children.filter((node) => {
    if (isNoiseElement(node)) return false;
    if (node.nodeType !== Node.TEXT_NODE) return true;
    const text = node.textContent ?? '';
    if (text.trim() !== '') return true;
    return !hasElement;
  });
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
    const tag = (node as Element).tagName.toLowerCase();
    return `${parentPath} > ${tag}:nth-child(${index + 1})`;
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return `${parentPath} > #comment[${index}]`;
  }
  return `${parentPath} > #text[${index}]`;
}
