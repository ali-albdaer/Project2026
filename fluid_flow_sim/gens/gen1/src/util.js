export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function nowSeconds() {
  return performance.now() * 0.001;
}

export function make2DIndex(n) {
  return (x, y) => x + y * n;
}

export function wrap01(t) {
  t = t % 1;
  return t < 0 ? t + 1 : t;
}

export function safeFinite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

export function formatNumber(v) {
  if (!Number.isFinite(v)) return 'NaN';
  const av = Math.abs(v);
  if (av >= 1000) return v.toFixed(0);
  if (av >= 100) return v.toFixed(1);
  if (av >= 10) return v.toFixed(2);
  if (av >= 1) return v.toFixed(3);
  return v.toExponential(2);
}

export function debounce(ms, fn) {
  let id = null;
  return (...args) => {
    if (id) clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}
