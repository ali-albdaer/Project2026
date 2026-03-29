// ────────────────────────────────────────────
// shapes.js — SDF generators and surface parametrizations
// ────────────────────────────────────────────
// Every shape exports a factory returning { sdf, surface, charLength }.
//   sdf(px, py)           → signed distance (negative inside)
//   surface(n)            → array of { x, y, nx, ny } (n sample points)
//   charLength            → characteristic length for Re computation

import { SHAPE } from '../config.js';

const TWO_PI = 2 * Math.PI;

// ── Utility ──────────────────────────────────

function rotatePoint(px, py, cx, cy, angle) {
    const dx = px - cx, dy = py - cy;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function unrotatePoint(px, py, cx, cy, angle) {
    return rotatePoint(px, py, cx, cy, -angle);
}

// ── Circle / Cylinder ───────────────────────

function circleShape(cx, cy, r, _angle) {
    return {
        charLength: 2 * r,
        sdf(px, py) {
            const dx = px - cx, dy = py - cy;
            return Math.sqrt(dx * dx + dy * dy) - r;
        },
        surface(n) {
            const pts = [];
            for (let i = 0; i < n; i++) {
                const a = (i / n) * TWO_PI;
                const cos = Math.cos(a), sin = Math.sin(a);
                pts.push({ x: cx + r * cos, y: cy + r * sin, nx: cos, ny: sin });
            }
            return pts;
        },
    };
}

// ── Ellipse ──────────────────────────────────

function ellipseShape(cx, cy, a, b, angle) {
    return {
        charLength: 2 * Math.max(a, b),
        sdf(px, py) {
            const [lx, ly] = unrotatePoint(px, py, cx, cy, angle);
            const dx = lx - cx, dy = ly - cy;
            // Approximate SDF for ellipse
            const nx = dx / a, ny = dy / b;
            const d = Math.sqrt(nx * nx + ny * ny);
            if (d < 1e-12) return -Math.min(a, b);
            const gx = dx / (a * a), gy = dy / (b * b);
            const glen = Math.sqrt(gx * gx + gy * gy);
            return (d - 1.0) / (glen / d * a * b / Math.max(a, b));
        },
        surface(n) {
            const pts = [];
            for (let i = 0; i < n; i++) {
                const t = (i / n) * TWO_PI;
                const lx = a * Math.cos(t), ly = b * Math.sin(t);
                // Normal to ellipse at parameter t
                const gnx = lx / (a * a), gny = ly / (b * b);
                const gl = Math.sqrt(gnx * gnx + gny * gny) || 1;
                // Transform to world
                const cos = Math.cos(angle), sin = Math.sin(angle);
                pts.push({
                    x: cx + lx * cos - ly * sin,
                    y: cy + lx * sin + ly * cos,
                    nx: (gnx * cos - gny * sin) / gl,
                    ny: (gnx * sin + gny * cos) / gl,
                });
            }
            return pts;
        },
    };
}

// ── Rectangle ────────────────────────────────

function rectangleShape(cx, cy, w, h, angle) {
    const hw = w / 2, hh = h / 2;
    return {
        charLength: Math.max(w, h),
        sdf(px, py) {
            const [lx, ly] = unrotatePoint(px, py, cx, cy, angle);
            const dx = Math.abs(lx - cx) - hw;
            const dy = Math.abs(ly - cy) - hh;
            const outsideDist = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2);
            const insideDist = Math.min(Math.max(dx, dy), 0);
            return outsideDist + insideDist;
        },
        surface(n) {
            const pts = [];
            const perim = 2 * (w + h);
            const cos = Math.cos(angle), sin = Math.sin(angle);
            for (let i = 0; i < n; i++) {
                const s = (i / n) * perim;
                let lx, ly, lnx, lny;
                if (s < w) {
                    lx = -hw + s; ly = -hh; lnx = 0; lny = -1;
                } else if (s < w + h) {
                    lx = hw; ly = -hh + (s - w); lnx = 1; lny = 0;
                } else if (s < 2 * w + h) {
                    lx = hw - (s - w - h); ly = hh; lnx = 0; lny = 1;
                } else {
                    lx = -hw; ly = hh - (s - 2 * w - h); lnx = -1; lny = 0;
                }
                pts.push({
                    x: cx + lx * cos - ly * sin,
                    y: cy + lx * sin + ly * cos,
                    nx: lnx * cos - lny * sin,
                    ny: lnx * sin + lny * cos,
                });
            }
            return pts;
        },
    };
}

// ── Rounded Rectangle ───────────────────────

function roundedRectShape(cx, cy, w, h, r, angle) {
    const hw = w / 2 - r, hh = h / 2 - r;
    return {
        charLength: Math.max(w, h),
        sdf(px, py) {
            const [lx, ly] = unrotatePoint(px, py, cx, cy, angle);
            const dx = Math.abs(lx - cx) - hw;
            const dy = Math.abs(ly - cy) - hh;
            const outsideDist = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2);
            const insideDist = Math.min(Math.max(dx, dy), 0);
            return outsideDist + insideDist - r;
        },
        surface(n) {
            const pts = [];
            const cos = Math.cos(angle), sin = Math.sin(angle);
            // Sample quarter-circles at corners + straight edges
            for (let i = 0; i < n; i++) {
                const t = (i / n) * TWO_PI;
                // approximate: parametrize around the rounded rect
                const corners = [
                    [hw, hh], [hw, -hh], [-hw, -hh], [-hw, hh]
                ];
                const seg = Math.floor(t / (Math.PI / 2)) % 4;
                const segT = (t - seg * Math.PI / 2) / (Math.PI / 2);
                const c = corners[seg];
                const a0 = seg * Math.PI / 2 - Math.PI / 2;
                const a = a0 + segT * Math.PI / 2;
                const lx = c[0] + r * Math.cos(a);
                const ly = c[1] + r * Math.sin(a);
                const lnx = Math.cos(a), lny = Math.sin(a);
                pts.push({
                    x: cx + lx * cos - ly * sin,
                    y: cy + lx * sin + ly * cos,
                    nx: lnx * cos - lny * sin,
                    ny: lnx * sin + lny * cos,
                });
            }
            return pts;
        },
    };
}

// ── Flat Plate ───────────────────────────────

function flatPlateShape(cx, cy, length, thickness, angle) {
    return rectangleShape(cx, cy, length, Math.max(thickness, 2), angle);
}

// ── Triangle (isoceles, pointing right) ─────

function triangleShape(cx, cy, base, height, angle) {
    // Vertices in local coords (centroid at origin)
    const thirdH = height / 3;
    const v0 = [2 * thirdH, 0];           // tip (right)
    const v1 = [-thirdH, base / 2];       // top-left
    const v2 = [-thirdH, -base / 2];      // bottom-left

    const verts = [v0, v1, v2];

    function edgeDist(px, py, ax, ay, bx, by) {
        const abx = bx - ax, aby = by - ay;
        const apx = px - ax, apy = py - ay;
        let t = (apx * abx + apy * aby) / (abx * abx + aby * aby);
        t = Math.max(0, Math.min(1, t));
        const dx = px - (ax + t * abx), dy = py - (ay + t * aby);
        return Math.sqrt(dx * dx + dy * dy);
    }

    function cross2d(ax, ay, bx, by) {
        return ax * by - ay * bx;
    }

    return {
        charLength: height,
        sdf(px, py) {
            const [lx, ly] = unrotatePoint(px, py, cx, cy, angle);
            const x = lx - cx, y = ly - cy;
            // Check if inside using cross products
            const c0 = cross2d(v1[0] - v0[0], v1[1] - v0[1], x - v0[0], y - v0[1]);
            const c1 = cross2d(v2[0] - v1[0], v2[1] - v1[1], x - v1[0], y - v1[1]);
            const c2 = cross2d(v0[0] - v2[0], v0[1] - v2[1], x - v2[0], y - v2[1]);
            const inside = (c0 >= 0 && c1 >= 0 && c2 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0);
            // Min distance to edges
            const d0 = edgeDist(x, y, v0[0], v0[1], v1[0], v1[1]);
            const d1 = edgeDist(x, y, v1[0], v1[1], v2[0], v2[1]);
            const d2 = edgeDist(x, y, v2[0], v2[1], v0[0], v0[1]);
            const d = Math.min(d0, d1, d2);
            return inside ? -d : d;
        },
        surface(n) {
            const pts = [];
            const cos = Math.cos(angle), sin = Math.sin(angle);
            const edges = [[v0, v1], [v1, v2], [v2, v0]];
            const lengths = edges.map(([a, b]) => Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2));
            const totalLen = lengths.reduce((s, l) => s + l, 0);
            for (let i = 0; i < n; i++) {
                let s = (i / n) * totalLen;
                let ei = 0;
                while (ei < 2 && s > lengths[ei]) { s -= lengths[ei]; ei++; }
                const [a, b] = edges[ei];
                const t = s / lengths[ei];
                const lx = a[0] + t * (b[0] - a[0]);
                const ly = a[1] + t * (b[1] - a[1]);
                // Outward normal
                const dx = b[0] - a[0], dy = b[1] - a[1];
                const nl = Math.sqrt(dx * dx + dy * dy) || 1;
                let lnx = dy / nl, lny = -dx / nl;
                // Ensure outward
                const mx = (a[0] + b[0]) / 2 + lnx * 0.1;
                const my = (a[1] + b[1]) / 2 + lny * 0.1;
                const c0 = cross2d(v1[0] - v0[0], v1[1] - v0[1], mx - v0[0], my - v0[1]);
                const c1 = cross2d(v2[0] - v1[0], v2[1] - v1[1], mx - v1[0], my - v1[1]);
                const c2 = cross2d(v0[0] - v2[0], v0[1] - v2[1], mx - v2[0], my - v2[1]);
                const insideN = (c0 >= 0 && c1 >= 0 && c2 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0);
                if (insideN) { lnx = -lnx; lny = -lny; }
                pts.push({
                    x: cx + lx * cos - ly * sin,
                    y: cy + lx * sin + ly * cos,
                    nx: lnx * cos - lny * sin,
                    ny: lnx * sin + lny * cos,
                });
            }
            return pts;
        },
    };
}

// ── Semicircle (flat side facing upstream) ───

function semicircleShape(cx, cy, r, angle) {
    return {
        charLength: 2 * r,
        sdf(px, py) {
            const [lx, ly] = unrotatePoint(px, py, cx, cy, angle);
            const dx = lx - cx, dy = ly - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dx >= 0) {
                // curved side
                return dist - r;
            } else {
                // flat side
                if (Math.abs(dy) <= r) {
                    return Math.max(-dx - 0, dist - r);
                }
                return dist - r;
            }
        },
        surface(n) {
            const pts = [];
            const cos = Math.cos(angle), sin = Math.sin(angle);
            const nCurve = Math.floor(n * 0.7);
            const nFlat = n - nCurve;
            // Curved part (right semicircle)
            for (let i = 0; i < nCurve; i++) {
                const a = -Math.PI / 2 + (i / nCurve) * Math.PI;
                const lx = r * Math.cos(a), ly = r * Math.sin(a);
                const lnx = Math.cos(a), lny = Math.sin(a);
                pts.push({
                    x: cx + lx * cos - ly * sin,
                    y: cy + lx * sin + ly * cos,
                    nx: lnx * cos - lny * sin,
                    ny: lnx * sin + lny * cos,
                });
            }
            // Flat part (left side)
            for (let i = 0; i < nFlat; i++) {
                const ly = r - (i / nFlat) * 2 * r;
                pts.push({
                    x: cx + 0 * cos - ly * sin,
                    y: cy + 0 * sin + ly * cos,
                    nx: -cos,
                    ny: -sin,
                });
            }
            return pts;
        },
    };
}

// ── Regular Hexagon ──────────────────────────

function hexagonShape(cx, cy, r, angle) {
    const verts = [];
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TWO_PI;
        verts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return polygonShape(cx, cy, verts, angle, 2 * r);
}

// ── Generic convex polygon SDF ───────────────

function polygonShape(cx, cy, localVerts, angle, charLen) {
    const n = localVerts.length;

    function cross2d(ax, ay, bx, by) { return ax * by - ay * bx; }

    function edgeDist(px, py, ax, ay, bx, by) {
        const abx = bx - ax, aby = by - ay;
        const apx = px - ax, apy = py - ay;
        let t = (apx * abx + apy * aby) / (abx * abx + aby * aby);
        t = Math.max(0, Math.min(1, t));
        const dx = px - (ax + t * abx), dy = py - (ay + t * aby);
        return Math.sqrt(dx * dx + dy * dy);
    }

    function isInside(x, y) {
        let pos = 0, neg = 0;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const c = cross2d(
                localVerts[j][0] - localVerts[i][0], localVerts[j][1] - localVerts[i][1],
                x - localVerts[i][0], y - localVerts[i][1]
            );
            if (c > 0) pos++; else if (c < 0) neg++;
        }
        return pos === 0 || neg === 0;
    }

    return {
        charLength: charLen,
        sdf(px, py) {
            const [lx, ly] = unrotatePoint(px, py, cx, cy, angle);
            const x = lx - cx, y = ly - cy;
            let minD = Infinity;
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                const d = edgeDist(x, y, localVerts[i][0], localVerts[i][1], localVerts[j][0], localVerts[j][1]);
                if (d < minD) minD = d;
            }
            return isInside(x, y) ? -minD : minD;
        },
        surface(ns) {
            const pts = [];
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            const lengths = [];
            let totalLen = 0;
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                const l = Math.sqrt(
                    (localVerts[j][0] - localVerts[i][0]) ** 2 +
                    (localVerts[j][1] - localVerts[i][1]) ** 2
                );
                lengths.push(l);
                totalLen += l;
            }
            for (let i = 0; i < ns; i++) {
                let s = (i / ns) * totalLen;
                let ei = 0;
                while (ei < n - 1 && s > lengths[ei]) { s -= lengths[ei]; ei++; }
                const a = localVerts[ei], b = localVerts[(ei + 1) % n];
                const t = s / lengths[ei];
                const lx = a[0] + t * (b[0] - a[0]);
                const ly = a[1] + t * (b[1] - a[1]);
                const dx = b[0] - a[0], dy = b[1] - a[1];
                const nl = Math.sqrt(dx * dx + dy * dy) || 1;
                let lnx = dy / nl, lny = -dx / nl;
                // Ensure outward: normal should point away from centroid (0,0)
                const testX = lx + lnx * 0.01, testY = ly + lny * 0.01;
                if (isInside(testX, testY)) { lnx = -lnx; lny = -lny; }
                pts.push({
                    x: cx + lx * cosA - ly * sinA,
                    y: cy + lx * sinA + ly * cosA,
                    nx: lnx * cosA - lny * sinA,
                    ny: lnx * sinA + lny * cosA,
                });
            }
            return pts;
        },
    };
}

// ── Ogive (tangent ogive / pointed nose) ─────

function ogiveShape(cx, cy, length, ogiveRadius, angle) {
    // A tangent ogive defined by length L and ogive radius R.
    // The nose is at +L/2, the base at -L/2.
    // r(x) = sqrt(R² - (x - x0)²) - (R - rBase)
    // where x0 is chosen so that the curve is tangent at the base.
    const L = length;
    const hL = L / 2;
    const R = ogiveRadius;
    const rBase = Math.sqrt(R * R - hL * hL); // base radius
    const yOff = R - rBase;

    return {
        charLength: length,
        sdf(px, py) {
            const [lx, ly] = unrotatePoint(px, py, cx, cy, angle);
            const x = lx - cx, y = ly - cy;
            if (x < -hL || x > hL) {
                // Beyond the length
                const clampX = Math.max(-hL, Math.min(hL, x));
                const rAtX = Math.sqrt(Math.max(0, R * R - clampX * clampX)) - yOff;
                const dx = x - clampX;
                const dy = Math.abs(y) - Math.max(0, rAtX);
                return Math.sqrt(dx * dx + Math.max(0, dy) ** 2) + Math.min(0, Math.max(dx, dy));
            }
            const rAtX = Math.sqrt(Math.max(0, R * R - x * x)) - yOff;
            return Math.abs(y) - rAtX;
        },
        surface(n) {
            const pts = [];
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            for (let i = 0; i < n; i++) {
                const t = i / n;
                const x = -hL + t * L;
                const rAtX = Math.sqrt(Math.max(0, R * R - x * x)) - yOff;
                const sign = (i < n / 2) ? 1 : -1;
                const ly = sign * Math.max(0, rAtX);
                // Tangent direction
                const drdx = rAtX > 0.01 ? -x / Math.sqrt(R * R - x * x) : 0;
                const tnx = -sign * drdx, tny = sign;
                const nl = Math.sqrt(tnx * tnx + tny * tny) || 1;
                pts.push({
                    x: cx + x * cosA - ly * sinA,
                    y: cy + x * sinA + ly * cosA,
                    nx: (tnx / nl) * cosA - (tny / nl) * sinA,
                    ny: (tnx / nl) * sinA + (tny / nl) * cosA,
                });
            }
            return pts;
        },
    };
}

// ── NACA 4-digit Airfoil ─────────────────────

function nacaAirfoilShape(cx, cy, nacaCode, chord, aoa, angle) {
    const m = parseInt(nacaCode[0]) / 100;     // max camber
    const p = parseInt(nacaCode[1]) / 10;      // location of max camber
    const t = parseInt(nacaCode.slice(2)) / 100; // max thickness

    function thickness(x) {
        return 5 * t * (
            0.2969 * Math.sqrt(x) -
            0.1260 * x -
            0.3516 * x * x +
            0.2843 * x * x * x -
            0.1015 * x * x * x * x
        );
    }

    function camber(x) {
        if (m === 0 || p === 0) return 0;
        if (x < p) return (m / (p * p)) * (2 * p * x - x * x);
        return (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x);
    }

    function dCamber(x) {
        if (m === 0 || p === 0) return 0;
        if (x < p) return (2 * m / (p * p)) * (p - x);
        return (2 * m / ((1 - p) * (1 - p))) * (p - x);
    }

    // Generate airfoil points
    const nPts = 80;
    const upperPts = [], lowerPts = [];

    for (let i = 0; i <= nPts; i++) {
        // Cosine spacing for better leading edge resolution
        const beta = (i / nPts) * Math.PI;
        const x = 0.5 * (1 - Math.cos(beta));
        const yt = thickness(x);
        const yc = camber(x);
        const dyc = dCamber(x);
        const theta = Math.atan(dyc);
        const xu = x - yt * Math.sin(theta);
        const yu = yc + yt * Math.cos(theta);
        const xl = x + yt * Math.sin(theta);
        const yl = yc - yt * Math.cos(theta);
        upperPts.push([xu * chord - chord / 2, yu * chord]);
        lowerPts.push([xl * chord - chord / 2, yl * chord]);
    }

    // Combine into single polygon (upper then lower reversed)
    const allPts = [...upperPts, ...lowerPts.reverse().slice(1)];

    // Apply AoA rotation (degrees to radians)
    const aoaRad = (aoa * Math.PI) / 180;
    const totalAngle = angle + aoaRad;

    return polygonShape(cx, cy, allPts, totalAngle, chord);
}

// ── I-Beam ───────────────────────────────────

function iBeamShape(cx, cy, w, h, flangeT, webT, angle) {
    // I-beam cross section: two horizontal flanges + vertical web
    // Build as polygon
    const hw = w / 2, hh = h / 2;
    const hweb = webT / 2;

    const verts = [
        [-hw, -hh], [hw, -hh],                     // bottom flange bottom
        [hw, -hh + flangeT],                        // bottom flange top-right
        [hweb, -hh + flangeT],                      // web bottom-right
        [hweb, hh - flangeT],                       // web top-right
        [hw, hh - flangeT],                         // top flange bottom-right
        [hw, hh],                                   // top flange top-right
        [-hw, hh],                                  // top flange top-left
        [-hw, hh - flangeT],                        // top flange bottom-left
        [-hweb, hh - flangeT],                      // web top-left
        [-hweb, -hh + flangeT],                     // web bottom-left
        [-hw, -hh + flangeT],                       // bottom flange top-left
    ];

    return polygonShape(cx, cy, verts, angle, h);
}

// ── T-Beam ───────────────────────────────────

function tBeamShape(cx, cy, w, h, flangeT, webT, angle) {
    const hw = w / 2, hh = h / 2;
    const hweb = webT / 2;

    const verts = [
        [-hweb, -hh],                               // web bottom-left
        [hweb, -hh],                                // web bottom-right
        [hweb, hh - flangeT],                       // web top-right
        [hw, hh - flangeT],                         // flange bottom-right
        [hw, hh],                                   // flange top-right
        [-hw, hh],                                  // flange top-left
        [-hw, hh - flangeT],                        // flange bottom-left
        [-hweb, hh - flangeT],                      // web top-left
    ];

    return polygonShape(cx, cy, verts, angle, h);
}

// ── Shape factory ────────────────────────────

export function createShape(type, cx, cy, params, angle = 0) {
    switch (type) {
        case SHAPE.CIRCLE:
        case SHAPE.CYLINDER:
            return circleShape(cx, cy, params.radius, angle);
        case SHAPE.ELLIPSE:
            return ellipseShape(cx, cy, params.a, params.b, angle);
        case SHAPE.RECTANGLE:
            return rectangleShape(cx, cy, params.width, params.height, angle);
        case SHAPE.ROUNDED_RECT:
            return roundedRectShape(cx, cy, params.width, params.height, params.cornerRadius, angle);
        case SHAPE.FLAT_PLATE:
            return flatPlateShape(cx, cy, params.length, params.thickness || 2, angle);
        case SHAPE.TRIANGLE:
            return triangleShape(cx, cy, params.base, params.height, angle);
        case SHAPE.SEMICIRCLE:
            return semicircleShape(cx, cy, params.radius, angle);
        case SHAPE.HEXAGON:
            return hexagonShape(cx, cy, params.radius, angle);
        case SHAPE.OGIVE:
            return ogiveShape(cx, cy, params.length, params.radius, angle);
        case SHAPE.AIRFOIL:
            return nacaAirfoilShape(cx, cy, params.naca || '0012', params.chord, params.aoa || 0, angle);
        case SHAPE.I_BEAM:
            return iBeamShape(cx, cy, params.width, params.height, params.flangeThickness, params.webThickness, angle);
        case SHAPE.T_BEAM:
            return tBeamShape(cx, cy, params.width, params.height, params.flangeThickness, params.webThickness, angle);
        default:
            console.warn(`Unknown shape: ${type}, falling back to circle`);
            return circleShape(cx, cy, 10, 0);
    }
}
