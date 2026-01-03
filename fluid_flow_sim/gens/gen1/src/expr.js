import * as math from 'https://cdn.jsdelivr.net/npm/mathjs@11.11.0/+esm';
import { safeFinite } from './util.js';

const DEFAULT_SCOPE = {
  pi: Math.PI,
};

export function compileExpression(exprText) {
  const trimmed = (exprText ?? '').trim();
  if (trimmed.length === 0) {
    return { ok: true, exprText: '0', compiled: () => 0, error: null };
  }

  try {
    const node = math.parse(trimmed);
    const code = node.compile();
    const compiled = (scope) => {
      const v = code.evaluate(scope);
      return safeFinite(typeof v === 'number' ? v : Number(v), 0);
    };
    return { ok: true, exprText: trimmed, compiled, error: null };
  } catch (e) {
    return { ok: false, exprText: trimmed, compiled: () => 0, error: e?.message ?? String(e) };
  }
}

export function makeScope({ x, y, t }) {
  const r = Math.hypot(x, y);
  const theta = Math.atan2(y, x);
  return { ...DEFAULT_SCOPE, x, y, t, r, theta };
}
