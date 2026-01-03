# Fluid Flow Lab (no npm)

A static web app for:

- **Potential flow superposition builder**: uniform + source/sink + vortex + doublet with draggable singularities and streamline/equipotential visualization.
- **Euler / Navier–Stokes (incompressible) solver**: real-time 2D stable-fluids style solver with editable forcing/source expressions, color-mapped scalar fields, and a hover probe.

## Run

From this folder:

```bash
python -m http.server 8000
```

Then open:

- `http://localhost:8000/`

## Controls

- `Space`: pause/resume
- `G`: toggle grid
- `H`: toggle UI
- `R`: reset current mode

## Notes

- **Euler vs Navier–Stokes**: set viscosity `ν = 0` for (approx.) Euler.
- **Equation editor** uses JavaScript expressions with `x,y ∈ [-1,1]` and time `t` (seconds). Use `Math.*`.
- Mouse drag in Navier–Stokes mode injects momentum/density when enabled.

## Troubleshooting

If your browser console shows errors like:

- `Failed to load resource: navierStokes.js (404)`
- `Uncaught ReferenceError: NavierStokesSolver is not defined`

then you are **not** serving/loading this app folder (which loads `app.js`), but some older page that references `main.js`/`navierStokes.js`.

Fix:

- Start `python -m http.server` from this `gen9` directory, and open `http://localhost:8000/`.
- Or if you start the server from a parent directory, open the `gen9` subpath in the URL.
- Hard refresh (`Ctrl+F5`) to bypass cached scripts.
