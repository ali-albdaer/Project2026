import { clamp } from '../util.js';

// Analytic fields cover the reference summary:
// - Potential flow elements (uniform, source/sink, vortex, doublet) and superposition.
// - Cylinder flow (uniform + doublet) and cylinder with circulation (+ vortex).
// - Exact viscous solutions: plane Poiseuille, Couette, Hagen–Poiseuille.

function cartToPolar(x, y) {
  return { r: Math.hypot(x, y), theta: Math.atan2(y, x) };
}

export function potentialUniform({ U = 1, angle = 0 } = {}) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  return {
    name: 'Uniform',
    velocity(x, y) {
      return { u: U * ca, v: U * sa };
    },
    phi(x, y) {
      return U * (x * ca + y * sa);
    },
    psi(x, y) {
      return U * (y * ca - x * sa);
    },
  };
}

export function potentialSource({ m = 5, cx = 0, cy = 0 } = {}) {
  return {
    name: 'Source/Sink',
    velocity(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      const r2 = dx * dx + dy * dy;
      const eps = 1e-6;
      const s = m / (2 * Math.PI);
      const inv = 1 / Math.max(r2, eps);
      return { u: s * dx * inv, v: s * dy * inv };
    },
    phi(x, y) {
      const { r } = cartToPolar(x - cx, y - cy);
      return (m / (2 * Math.PI)) * Math.log(Math.max(r, 1e-6));
    },
    psi(x, y) {
      const { theta } = cartToPolar(x - cx, y - cy);
      return (m / (2 * Math.PI)) * theta;
    },
  };
}

export function potentialVortex({ Gamma = 5, cx = 0, cy = 0 } = {}) {
  return {
    name: 'Irrotational Vortex',
    velocity(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      const r2 = dx * dx + dy * dy;
      const eps = 1e-6;
      const s = Gamma / (2 * Math.PI);
      const inv = 1 / Math.max(r2, eps);
      // Tangential: V = Gamma / (2πr)
      return { u: -s * dy * inv, v: s * dx * inv };
    },
    phi(x, y) {
      const { theta } = cartToPolar(x - cx, y - cy);
      return (Gamma / (2 * Math.PI)) * theta;
    },
    psi(x, y) {
      const { r } = cartToPolar(x - cx, y - cy);
      return -(Gamma / (2 * Math.PI)) * Math.log(Math.max(r, 1e-6));
    },
  };
}

export function potentialDoublet({ kappa = 5, angle = 0, cx = 0, cy = 0 } = {}) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  return {
    name: 'Doublet',
    velocity(x, y) {
      // Doublet oriented along angle; implemented by rotating coords.
      const dx = x - cx;
      const dy = y - cy;
      const xr = dx * ca + dy * sa;
      const yr = -dx * sa + dy * ca;
      const r2 = xr * xr + yr * yr;
      const eps = 1e-6;
      const inv2 = 1 / Math.max(r2 * r2, eps);
      const uR = (-kappa / (2 * Math.PI)) * (xr * xr - yr * yr) * inv2;
      const vR = (-kappa / (2 * Math.PI)) * (2 * xr * yr) * inv2;
      // Rotate back
      const u = uR * ca - vR * sa;
      const v = uR * sa + vR * ca;
      return { u, v };
    },
    phi(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      const xr = dx * ca + dy * sa;
      const yr = -dx * sa + dy * ca;
      const { r, theta } = cartToPolar(xr, yr);
      return (kappa / (2 * Math.PI)) * Math.cos(theta) / Math.max(r, 1e-6);
    },
    psi(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      const xr = dx * ca + dy * sa;
      const yr = -dx * sa + dy * ca;
      const { r, theta } = cartToPolar(xr, yr);
      return -(kappa / (2 * Math.PI)) * Math.sin(theta) / Math.max(r, 1e-6);
    },
  };
}

export function superposition(elements = []) {
  return {
    name: 'Superposition',
    velocity(x, y) {
      let u = 0;
      let v = 0;
      for (const e of elements) {
        const vv = e.velocity(x, y);
        u += vv.u;
        v += vv.v;
      }
      return { u, v };
    },
    phi(x, y) {
      let s = 0;
      for (const e of elements) s += e.phi?.(x, y) ?? 0;
      return s;
    },
    psi(x, y) {
      let s = 0;
      for (const e of elements) s += e.psi?.(x, y) ?? 0;
      return s;
    },
  };
}

export function cylinderFlow({ U = 1, R = 0.35, angle = 0, cx = 0, cy = 0, Gamma = 0 } = {}) {
  // Standard inviscid potential flow around a cylinder:
  // uniform + doublet with kappa = 2π U R^2 (scaled here)
  // plus optional circulation vortex.
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const kappa = 2 * Math.PI * U * R * R;

  const uniform = potentialUniform({ U, angle });
  const dbl = potentialDoublet({ kappa, angle, cx, cy });
  const vort = potentialVortex({ Gamma, cx, cy });

  const field = superposition(Gamma !== 0 ? [uniform, dbl, vort] : [uniform, dbl]);

  return {
    name: 'Cylinder',
    ...field,
    // Useful for UI rendering
    meta: { R, cx, cy, angle, U, Gamma },
    maskSolid(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      return (dx * dx + dy * dy) <= R * R;
    }
  };
}

// --- Viscous exact solutions ---

export function planePoiseuille({ mu = 1, dPdx = -2, h = 0.6 } = {}) {
  // Plates at y = ±h. u(y) = (1/(2μ)) dP/dx (y^2 - h^2)
  return {
    name: 'Plane Poiseuille',
    velocity(x, y) {
      const u = (1 / (2 * mu)) * dPdx * (y * y - h * h);
      return { u, v: 0 };
    },
    pressure(x, y) {
      // Only gradient matters; return linear proxy
      return dPdx * x;
    },
    meta: { mu, dPdx, h }
  };
}

export function couette({ U = 1, b = 1.2, mu = 1, dPdx = 0 } = {}) {
  // Plate at y=0 stationary, y=b moving with U.
  // u(y) = U y/b + (1/(2μ)) dP/dx (y^2 - b y)
  return {
    name: 'Couette',
    velocity(x, y) {
      // Map [-1,1] -> [0,b]
      const yy = clamp((y + 1) * 0.5 * b, 0, b);
      const u = U * (yy / b) + (1 / (2 * mu)) * dPdx * (yy * yy - b * yy);
      return { u, v: 0 };
    },
    pressure(x, y) {
      return dPdx * x;
    },
    meta: { U, b, mu, dPdx }
  };
}

export function hagenPoiseuille({ mu = 1, dPdz = -2, R = 0.75 } = {}) {
  // Pipe axial velocity Vz(r) = (1/(4μ)) dP/dz (r^2 - R^2).
  // We visualize Vz as u and set v=0 in a 2D cross-section.
  return {
    name: 'Hagen–Poiseuille',
    velocity(x, y) {
      const r = Math.hypot(x, y);
      if (r > R) return { u: 0, v: 0 };
      const u = (1 / (4 * mu)) * dPdz * (r * r - R * R);
      return { u, v: 0 };
    },
    pressure(x, y) {
      return dPdz * 0; // not meaningful in cross-section
    },
    meta: { mu, dPdz, R }
  };
}
