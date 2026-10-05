// Tiny DOM helpers.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export const reducedMotion = () => document.documentElement.classList.contains('reduced');

export function formatDate(d = new Date()) {
  try {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  } catch (e) {
    return d.toDateString();
  }
}
