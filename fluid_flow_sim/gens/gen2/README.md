# Interactive Fluid Flow Simulation

This is a real-time, interactive fluid flow simulation web app covering concepts from Fluid Mechanics.

## Features
- **Potential Flow**: Visualize superposition of elementary flows (Uniform, Source, Vortex, Doublet).
- **Exact Viscous Solutions**: Visualize Poiseuille, Couette, and Pipe flows.
- **Navier-Stokes Solver**: A general purpose grid-based fluid solver demonstrating advection, diffusion, and pressure projection.
- **Real-time Visualization**: View Velocity, Pressure, Vorticity, Stream Function, and Dye.
- **Probe Tool**: Inspect flow properties at any point.

## How to Run
Since this app uses ES6 modules, it must be served via a local web server (opening `index.html` directly won't work due to CORS policies).

### Using Python (Recommended)
1. Open a terminal in this directory.
2. Run:
   ```bash
   python -m http.server
   ```
3. Open your browser and navigate to `http://localhost:8000`.

## Controls
- **Sidebar**: Select simulation type, adjust parameters, and toggle visualization modes.
- **Mouse**:
  - **Potential/Viscous**: Hover to probe (if enabled).
  - **Navier-Stokes**: Click and drag to add dye and velocity to the flow.
