//! Main simulation engine
//!
//! Combines all physics components into a single simulation that can be
//! advanced by step, checkpointed, and serialized.

use crate::body::{Body, BodyId};
use crate::collision::process_collisions;
use crate::force::{compute_accelerations_direct, compute_total_energy};
use crate::integrator::{step, IntegratorConfig, IntegratorType};
use crate::octree::compute_accelerations_barnes_hut;
use crate::prng::Pcg32;
use crate::snapshot::Snapshot;
use crate::force::{compute_accelerations_direct_from_positions, gravitational_acceleration};
use crate::vector::Vec3;

/// Force calculation method
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ForceMethod {
    /// Direct O(N²) calculation - most accurate
    Direct,
    /// Barnes-Hut O(N log N) approximation - faster for large N
    BarnesHut,
}

impl Default for ForceMethod {
    fn default() -> Self {
        // Use direct by default for accuracy; switch to Barnes-Hut for N > 50
        Self::Direct
    }
}

/// Simulation configuration
#[derive(Debug, Clone)]
pub struct SimulationConfig {
    /// Integrator settings
    pub integrator: IntegratorConfig,
    
    /// Force calculation method
    pub force_method: ForceMethod,
    
    /// Enable collision detection and merging
    pub enable_collisions: bool,
    
    /// Threshold for auto-switching to Barnes-Hut
    pub barnes_hut_threshold: usize,

    /// Close encounter configuration
    pub close_encounter: CloseEncounterConfig,
}

impl Default for SimulationConfig {
    fn default() -> Self {
        Self {
            integrator: IntegratorConfig::default(),
            force_method: ForceMethod::Direct,
            enable_collisions: true,
            barnes_hut_threshold: 50,
            close_encounter: CloseEncounterConfig::default(),
        }
    }
}

/// Close encounter switching settings
#[derive(Debug, Clone, Copy)]
pub struct CloseEncounterConfig {
    pub enabled: bool,
    pub enter_hill_ratio: f64,
    pub exit_hill_ratio: f64,
    pub enter_acc_ratio: f64,
    pub energy_error_threshold: f64,
    pub close_integrator: IntegratorType,
}

#[derive(Debug, Clone, Copy)]
struct CloseEncounterCandidate {
    primary: BodyId,
    secondary: BodyId,
    eta: f64,
    acc_ratio: f64,
}

impl Default for CloseEncounterConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            enter_hill_ratio: 3.0,
            exit_hill_ratio: 6.0,
            enter_acc_ratio: 0.2,
            energy_error_threshold: 1e-3,
            close_integrator: IntegratorType::RK45,
        }
    }
}

/// The main simulation state
#[derive(Debug)]
pub struct Simulation {
    /// All bodies in the simulation
    bodies: Vec<Body>,
    
    /// Configuration
    config: SimulationConfig,
    
    /// Deterministic RNG
    rng: Pcg32,
    
    /// Current simulation time in seconds
    time: f64,
    
    /// Current tick count
    tick: u64,
    
    /// Snapshot sequence number
    sequence: u64,
    
    /// Next body ID to assign
    next_id: BodyId,
    
    /// Whether accelerations need initialization
    needs_init: bool,

    /// Close encounter state
    close_encounter_active: bool,
    close_checkpoint: Option<Snapshot>,
    close_checkpoint_energy: f64,
}

impl Simulation {
    /// Create a new simulation with the given seed.
    pub fn new(seed: u64) -> Self {
        Self {
            bodies: Vec::with_capacity(100),
            config: SimulationConfig::default(),
            rng: Pcg32::new(seed),
            time: 0.0,
            tick: 0,
            sequence: 0,
            next_id: 0,
            needs_init: true,
            close_encounter_active: false,
            close_checkpoint: None,
            close_checkpoint_energy: 0.0,
        }
    }

    /// Create with custom configuration
    pub fn with_config(seed: u64, config: SimulationConfig) -> Self {
        let mut sim = Self::new(seed);
        sim.config = config;
        sim
    }

    /// Add a body to the simulation
    pub fn add_body(&mut self, mut body: Body) -> BodyId {
        body.id = self.next_id;
        self.next_id += 1;
        let id = body.id;
        self.bodies.push(body);
        self.needs_init = true;
        id
    }

    /// Create and add a star at the origin
    pub fn add_star(&mut self, name: &str, mass: f64, radius: f64) -> BodyId {
        let body = Body::star(0, name, mass, radius);
        self.add_body(body)
    }

    /// Create and add a planet
    pub fn add_planet(
        &mut self,
        name: &str,
        mass: f64,
        radius: f64,
        orbital_distance: f64,
        orbital_velocity: f64,
    ) -> BodyId {
        let body = Body::planet(0, name, mass, radius, orbital_distance, orbital_velocity);
        self.add_body(body)
    }

    /// Create and add a moon relative to a parent body
    pub fn add_moon(
        &mut self,
        name: &str,
        mass: f64,
        radius: f64,
        parent_id: BodyId,
        orbital_distance: f64,
        orbital_velocity: f64,
    ) -> Option<BodyId> {
        let parent = self.get_body(parent_id)?;
        let parent_clone = parent.clone();
        let body = Body::moon(0, name, mass, radius, &parent_clone, orbital_distance, orbital_velocity);
        Some(self.add_body(body))
    }

    /// Get a reference to a body by ID
    pub fn get_body(&self, id: BodyId) -> Option<&Body> {
        self.bodies.iter().find(|b| b.id == id)
    }

    /// Get a mutable reference to a body by ID
    pub fn get_body_mut(&mut self, id: BodyId) -> Option<&mut Body> {
        self.bodies.iter_mut().find(|b| b.id == id)
    }

    /// Remove a body from the simulation
    pub fn remove_body(&mut self, id: BodyId) -> bool {
        if let Some(body) = self.bodies.iter_mut().find(|b| b.id == id) {
            body.is_active = false;
            true
        } else {
            false
        }
    }

    /// Get all bodies
    pub fn bodies(&self) -> &[Body] {
        &self.bodies
    }

    /// Get active bodies
    pub fn active_bodies(&self) -> impl Iterator<Item = &Body> {
        self.bodies.iter().filter(|b| b.is_active)
    }

    /// Get current simulation time
    pub fn time(&self) -> f64 {
        self.time
    }

    /// Get current tick count
    pub fn tick(&self) -> u64 {
        self.tick
    }

    /// Advance simulation by one tick
    pub fn step(&mut self) {
        if self.needs_init {
            self.compute_accelerations();
            self.needs_init = false;
        }

        self.update_close_encounter_state();

        let mut integrator = self.config.integrator;
        if self.close_encounter_active {
            integrator.method = self.config.close_encounter.close_integrator;
        }

        // Advance physics
        let dt_advanced = step(&mut self.bodies, &integrator);
        
        // Handle collisions
        if self.config.enable_collisions {
            process_collisions(&mut self.bodies);
        }

        if self.close_encounter_active {
            let energy = self.total_energy();
            if self.close_checkpoint.is_some() {
                let base = self.close_checkpoint_energy.abs().max(1.0);
                let error = ((energy - self.close_checkpoint_energy) / base).abs();
                if error > self.config.close_encounter.energy_error_threshold {
                    if let Some(snapshot) = self.close_checkpoint.take() {
                        let _ = self.restore(snapshot);
                        self.close_encounter_active = false;
                        println!(
                            "[sim] Close-encounter integrator reverted (energy error {:.4}).",
                            error
                        );
                        return;
                    }
                }
            }
        }

        self.time += dt_advanced;
        self.tick += 1;
        self.sequence += 1;
    }

    fn update_close_encounter_state(&mut self) {
        if !self.config.close_encounter.enabled {
            self.close_encounter_active = false;
            self.close_checkpoint = None;
            return;
        }

        let candidate = self.compute_close_encounter_candidate();

        if self.close_encounter_active {
            if let Some(min_eta) = self.compute_min_hill_ratio() {
                if min_eta > self.config.close_encounter.exit_hill_ratio {
                    self.close_encounter_active = false;
                    self.close_checkpoint = None;
                    println!("[sim] Close-encounter integrator exit (eta {:.3}).", min_eta);
                }
            }
            return;
        }

        if let Some(candidate) = candidate {
            self.close_encounter_active = true;
            self.close_checkpoint = Some(self.snapshot());
            self.close_checkpoint_energy = self.total_energy();

            println!(
                "[sim] Close-encounter integrator enter bodies {}-{}, eta {:.3}, acc {:.3}",
                candidate.primary,
                candidate.secondary,
                candidate.eta,
                candidate.acc_ratio
            );
        }
    }

    fn compute_close_encounter_candidate(&self) -> Option<CloseEncounterCandidate> {
        let (positions, _velocities, masses, active) = self.collect_state();
        let accelerations = compute_accelerations_direct_from_positions(
            &positions,
            &masses,
            &active,
            &self.config.integrator.force_config,
        );

        let mut best: Option<CloseEncounterCandidate> = None;
        let softening_squared = self.config.integrator.force_config.softening
            * self.config.integrator.force_config.softening;

        for i in 0..positions.len() {
            if !active[i] || masses[i] <= 0.0 {
                continue;
            }
            for j in (i + 1)..positions.len() {
                if !active[j] || masses[j] <= 0.0 {
                    continue;
                }

                let dist = positions[i].distance(positions[j]);
                if dist <= 0.0 {
                    continue;
                }

                let (small_idx, large_idx) = if masses[i] <= masses[j] { (i, j) } else { (j, i) };
                let hill = dist * (masses[small_idx] / (3.0 * masses[large_idx])).powf(1.0 / 3.0);
                if hill <= 0.0 {
                    continue;
                }

                let eta = dist / hill;
                let pair_acc = gravitational_acceleration(
                    positions[small_idx],
                    positions[large_idx],
                    masses[large_idx],
                    softening_squared,
                )
                .length();
                let total_acc = accelerations[small_idx].length().max(1e-12);
                let acc_ratio = pair_acc / total_acc;

                if eta < self.config.close_encounter.enter_hill_ratio
                    && acc_ratio > self.config.close_encounter.enter_acc_ratio
                {
                    let candidate = CloseEncounterCandidate {
                        primary: self.bodies[small_idx].id,
                        secondary: self.bodies[large_idx].id,
                        eta,
                        acc_ratio,
                    };
                    if best.as_ref().map_or(true, |b| eta < b.eta) {
                        best = Some(candidate);
                    }
                }
            }
        }

        best
    }

    fn compute_min_hill_ratio(&self) -> Option<f64> {
        let (positions, _velocities, masses, active) = self.collect_state();
        let mut min_eta: Option<f64> = None;

        for i in 0..positions.len() {
            if !active[i] || masses[i] <= 0.0 {
                continue;
            }
            for j in (i + 1)..positions.len() {
                if !active[j] || masses[j] <= 0.0 {
                    continue;
                }

                let dist = positions[i].distance(positions[j]);
                if dist <= 0.0 {
                    continue;
                }

                let (small_idx, large_idx) = if masses[i] <= masses[j] { (i, j) } else { (j, i) };
                let hill = dist * (masses[small_idx] / (3.0 * masses[large_idx])).powf(1.0 / 3.0);
                if hill <= 0.0 {
                    continue;
                }

                let eta = dist / hill;
                min_eta = Some(min_eta.map_or(eta, |v: f64| v.min(eta)));
            }
        }

        min_eta
    }

    fn collect_state(&self) -> (Vec<Vec3>, Vec<Vec3>, Vec<f64>, Vec<bool>) {
        let mut positions = Vec::with_capacity(self.bodies.len());
        let mut velocities = Vec::with_capacity(self.bodies.len());
        let mut masses = Vec::with_capacity(self.bodies.len());
        let mut active = Vec::with_capacity(self.bodies.len());

        for body in &self.bodies {
            positions.push(body.position);
            velocities.push(body.velocity);
            masses.push(if body.is_massive { body.mass } else { 0.0 });
            active.push(body.is_active);
        }

        (positions, velocities, masses, active)
    }

    /// Advance simulation by multiple ticks
    pub fn step_n(&mut self, n: u64) {
        for _ in 0..n {
            self.step();
        }
    }

    /// Compute accelerations using configured method
    fn compute_accelerations(&mut self) {
        // Auto-select method based on body count
        let method = if self.bodies.len() > self.config.barnes_hut_threshold {
            ForceMethod::BarnesHut
        } else {
            self.config.force_method
        };

        match method {
            ForceMethod::Direct => {
                compute_accelerations_direct(&mut self.bodies, &self.config.integrator.force_config);
            }
            ForceMethod::BarnesHut => {
                compute_accelerations_barnes_hut(&mut self.bodies, &self.config.integrator.force_config);
            }
        }
    }

    /// Get total energy of the system
    pub fn total_energy(&self) -> f64 {
        compute_total_energy(&self.bodies, self.config.integrator.force_config.softening)
    }

    /// Create a snapshot of current state
    pub fn snapshot(&self) -> Snapshot {
        Snapshot::new(
            self.sequence,
            self.time,
            self.tick,
            &self.rng,
            self.bodies.clone(),
            &self.config.integrator.force_config,
            &self.config.integrator,
            &self.config.close_encounter,
        )
    }

    /// Restore from a snapshot
    pub fn restore(&mut self, snapshot: Snapshot) -> Result<(), &'static str> {
        snapshot.validate()?;

        self.sequence = snapshot.sequence;
        self.time = snapshot.time;
        self.tick = snapshot.tick;
        self.bodies = snapshot.bodies;
        self.rng = Pcg32::from_state(snapshot.rng_state.0, snapshot.rng_state.1);
        self.config.integrator = (&snapshot.integrator_config).into();
        self.config.integrator.force_config = (&snapshot.force_config).into();
        self.config.close_encounter = (&snapshot.close_encounter_config).into();
        self.needs_init = true;
        self.close_encounter_active = false;
        self.close_checkpoint = None;

        // Update next_id to avoid collisions
        self.next_id = self.bodies.iter().map(|b| b.id).max().unwrap_or(0) + 1;

        Ok(())
    }

    /// Export to JSON
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        self.snapshot().to_json()
    }

    /// Import from JSON
    pub fn from_json(json: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let snapshot = Snapshot::from_json(json)?;
        let mut sim = Self::new(snapshot.rng_state.0);
        sim.restore(snapshot)?;
        Ok(sim)
    }

    /// Get positions as a flat array [x0, y0, z0, x1, y1, z1, ...]
    pub fn positions_flat(&self) -> Vec<f64> {
        let mut result = Vec::with_capacity(self.bodies.len() * 3);
        for body in &self.bodies {
            if body.is_active {
                result.push(body.position.x);
                result.push(body.position.y);
                result.push(body.position.z);
            }
        }
        result
    }

    /// Get velocities as a flat array
    pub fn velocities_flat(&self) -> Vec<f64> {
        let mut result = Vec::with_capacity(self.bodies.len() * 3);
        for body in &self.bodies {
            if body.is_active {
                result.push(body.velocity.x);
                result.push(body.velocity.y);
                result.push(body.velocity.z);
            }
        }
        result
    }

    /// Set configuration
    pub fn set_config(&mut self, config: SimulationConfig) {
        self.config = config;
        self.needs_init = true;
    }

    /// Get configuration
    pub fn config(&self) -> &SimulationConfig {
        &self.config
    }

    /// Check if close-encounter mode is active
    pub fn close_encounter_active(&self) -> bool {
        self.close_encounter_active
    }

    /// Set timestep
    pub fn set_dt(&mut self, dt: f64) {
        self.config.integrator.dt = dt;
        if self.config.integrator.adaptive.max_dt < dt {
            self.config.integrator.adaptive.max_dt = dt;
        }
    }

    /// Set substeps
    pub fn set_substeps(&mut self, substeps: u32) {
        self.config.integrator.substeps = substeps;
    }

    /// Set Barnes-Hut theta
    pub fn set_theta(&mut self, theta: f64) {
        self.config.integrator.force_config.barnes_hut_theta = theta;
    }

    /// Set force method
    pub fn set_force_method(&mut self, method: ForceMethod) {
        self.config.force_method = method;
        self.needs_init = true;
    }

    /// Set close-encounter integrator
    pub fn set_close_encounter_integrator(&mut self, method: IntegratorType) {
        self.config.close_encounter.close_integrator = method;
    }

    /// Enable or disable close-encounter switching
    pub fn set_close_encounter_enabled(&mut self, enabled: bool) {
        self.config.close_encounter.enabled = enabled;
    }

    /// Get a random number from the deterministic RNG
    pub fn random(&mut self) -> f64 {
        self.rng.next_f64()
    }

    /// Get PRNG state for serialization
    pub fn rng_state(&self) -> (u64, u64) {
        self.rng.state()
    }

    /// Number of active bodies
    pub fn body_count(&self) -> usize {
        self.bodies.iter().filter(|b| b.is_active).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::*;
    use crate::body::BodyType;
    use crate::vector::Vec3;

    fn create_earth_sun_system() -> Simulation {
        let mut sim = Simulation::new(42);
        
        sim.add_star("Sun", M_SUN, R_SUN);
        sim.add_planet("Earth", M_EARTH, R_EARTH, AU, 29784.0);
        
        sim
    }

    #[test]
    fn test_basic_simulation() {
        let mut sim = create_earth_sun_system();
        
        assert_eq!(sim.body_count(), 2);
        
        // Run for 100 steps
        for _ in 0..100 {
            sim.step();
        }
        
        assert!(sim.tick() == 100);
        assert!(sim.time() > 0.0);
    }

    #[test]
    fn test_snapshot_restore() {
        let mut sim = create_earth_sun_system();
        
        // Run for a while
        sim.step_n(100);
        let snapshot = sim.snapshot();
        let json = snapshot.to_json().expect("Serialization failed");
        
        // Run more
        let energy_before = sim.total_energy();
        sim.step_n(100);
        
        // Restore
        let restored_snapshot = Snapshot::from_json(&json).expect("Deserialization failed");
        sim.restore(restored_snapshot).expect("Restore failed");
        
        assert_eq!(sim.tick(), 100);
    }

    #[test]
    fn test_determinism() {
        // Two simulations with same seed should produce identical results
        let mut sim1 = create_earth_sun_system();
        let mut sim2 = create_earth_sun_system();
        
        for _ in 0..1000 {
            sim1.step();
            sim2.step();
        }
        
        // Positions should be identical
        let pos1 = sim1.bodies()[1].position;
        let pos2 = sim2.bodies()[1].position;
        
        assert!((pos1 - pos2).length() < 1e-10, "Simulations diverged!");
    }

    #[test]
    fn test_add_moon() {
        let mut sim = create_earth_sun_system();
        
        let earth_id = 1; // Second body added
        let moon_id = sim.add_moon("Moon", M_MOON, R_MOON, earth_id, 3.844e8, 1022.0);
        
        assert!(moon_id.is_some());
        assert_eq!(sim.body_count(), 3);
    }

    #[test]
    fn test_close_encounter_switching() {
        let mut sim = Simulation::new(7);

        let sun = Body::new(0, "Sun", BodyType::Star, 1.0e24, R_SUN, Vec3::ZERO, Vec3::ZERO);
        let planet = Body::new(
            1,
            "Planet",
            BodyType::Planet,
            1.0e24,
            R_EARTH,
            Vec3::new(1.0e7, 0.0, 0.0),
            Vec3::new(0.0, 0.0, 0.0),
        );

        sim.add_body(sun);
        let planet_id = sim.add_body(planet);

        sim.config.close_encounter.enabled = true;
        sim.config.close_encounter.enter_hill_ratio = 3.0;
        sim.config.close_encounter.exit_hill_ratio = 1.0;
        sim.config.close_encounter.enter_acc_ratio = 0.0;
        sim.config.close_encounter.energy_error_threshold = 10.0;
        sim.config.close_encounter.close_integrator = IntegratorType::GaussRadau;

        sim.step();
        assert!(sim.close_encounter_active(), "Expected close-encounter mode to activate");

        if let Some(body) = sim.get_body_mut(planet_id) {
            body.position = Vec3::new(1.0e12, 0.0, 0.0);
            body.velocity = Vec3::ZERO;
        }

        sim.config.close_encounter.enabled = false;
        sim.step();
        assert!(!sim.close_encounter_active(), "Expected close-encounter mode to exit");
    }
}
