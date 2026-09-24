/* Stable DOM reconciliation for frequently updating game surfaces.
 * Does not replace focused controls, open reading panels, or selected text.
 * No framework, timers, storage, or game-state mutations. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WTTNView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const previous = new WeakMap();
  const identity = node => node.nodeType === 1 ? node.id || ['producer','upgrade','project','atlas-field','collection','field-context'].map(k => node.getAttribute('data-' + k)).find(Boolean) || '' : '';
  function compatible(a, b) {
    return a && b && a.nodeType === b.nodeType && (a.nodeType !== 1 || (a.tagName === b.tagName && a.namespaceURI === b.namespaceURI && identity(a) === identity(b)));
  }
  function reconcile(current, next) {
    if (current.nodeType === 3 || current.nodeType === 8) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      return;
    }
    const interactiveOpen = current.tagName === 'DETAILS';
    for (const attr of [...current.attributes]) {
      if (interactiveOpen && attr.name === 'open') continue;
      if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    }
    for (const attr of [...next.attributes]) {
      if (interactiveOpen && attr.name === 'open') continue;
      if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    }
    syncChildren(current, next);
  }
  function syncChildren(current, next) {
    const desired = [...next.childNodes];
    for (let i = 0; i < desired.length; i++) {
      let old = current.childNodes[i];
      const incoming = desired[i];
      if (!compatible(old, incoming)) {
        const key = identity(incoming);
        const existing = key ? [...current.childNodes].slice(i + 1).find(n => compatible(n, incoming)) : null;
        if (existing) { current.insertBefore(existing, old || null); old = existing; }
        else { const clone = incoming.cloneNode(true); if (old) current.replaceChild(clone, old); else current.appendChild(clone); continue; }
      }
      reconcile(old, incoming);
    }
    while (current.childNodes.length > desired.length) current.lastChild.remove();
  }
  function patch(element, html) {
    if (!element) return false;
    const pane = element.closest?.('.tab-pane');
    if (pane && !pane.classList.contains('active')) return false;
    const value = String(typeof html === 'function' ? html() : html);
    if (previous.get(element) === value) return false;
    // A shallow clone preserves the namespace when reconciling SVG content.
    const draft = element.cloneNode(false);
    draft.innerHTML = value;
    syncChildren(element, draft);
    previous.set(element, value);
    return true;
  }
  return { patch };
});
