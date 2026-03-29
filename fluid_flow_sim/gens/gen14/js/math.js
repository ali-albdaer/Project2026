export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rotateToLocal(x, y, cx, cy, cosA, sinA) {
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: dx * cosA + dy * sinA,
    y: -dx * sinA + dy * cosA
  };
}

export function bilerp(data, nx, ny, x, y) {
  const fx = clamp(x, 0, nx - 1.001);
  const fy = clamp(y, 0, ny - 1.001);
  const x0 = fx | 0;
  const y0 = fy | 0;
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = fx - x0;
  const ty = fy - y0;

  const i00 = x0 + nx * y0;
  const i10 = x1 + nx * y0;
  const i01 = x0 + nx * y1;
  const i11 = x1 + nx * y1;

  const a = lerp(data[i00], data[i10], tx);
  const b = lerp(data[i01], data[i11], tx);
  return lerp(a, b, ty);
}

export function norm2(x, y) {
  return Math.sqrt(x * x + y * y);
}

export function safeDiv(a, b) {
  if (Math.abs(b) < 1e-8) {
    return 0;
  }
  return a / b;
}

export function compileScalarFieldExpression(expr, fallback = 0) {
  const trimmed = (expr || "").trim();
  if (!trimmed) {
    return () => fallback;
  }

  const fn = new Function(
    "x",
    "y",
    "t",
    "Math",
    `return (${trimmed});`
  );

  return (x, y, t) => {
    try {
      const v = fn(x, y, t, Math);
      return Number.isFinite(v) ? v : fallback;
    } catch {
      return fallback;
    }
  };
}
