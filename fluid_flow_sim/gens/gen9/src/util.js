export function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function fmt(x, digits = 3) {
  if (!Number.isFinite(x)) return String(x);
  const p = Math.pow(10, digits);
  return String(Math.round(x * p) / p);
}

export function hypot2(x, y) {
  return Math.sqrt(x * x + y * y);
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
