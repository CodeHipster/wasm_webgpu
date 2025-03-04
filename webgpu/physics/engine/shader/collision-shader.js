export default /*wgsl*/`
const MAX_PARTICLES_PER_CELL: u32 = 30; // 1000 * 1000 * 30 is close to 128mb max storage space. Max size is 1000

struct GlobalVars {
  gravity: vec2i, // (x,y) acceleration
  min: i32,
  max: i32,
  physics_scale: i32, // for scaling down to grid size
  rander_scale: i32, // for scaling down to clip_space
  sps_2: i32, // steps per second squared
  size: i32, // size of the simulation, x=y (it is a square)
};


struct Particle {
  position: vec2<i32>,
  prev_position: vec2<i32>,
};

// Storage Buffers
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>; 
@group(0) @binding(1) var<uniform> globals: GlobalVars;
@group(0) @binding(2) var<storage, read_write> grid: array<u32>; // Stores particle indices
@group(0) @binding(3) var<storage, read_write> grid_count: array<atomic<u32>>; // Particle count per cell
@group(0) @binding(4) var<storage, read_write> particle_displacement: array<atomic<i32>>; // Particle displacement 2 ints for each particle. x & y

// Hash function: Maps a position to a grid index
fn gridIndex(pos: vec2<i32>) -> u32 {
  // To move from signed ints to unsigned ints, 
  let align = globals.size / 2;
  // the width of the grid.

  let x = (pos.x / globals.physics_scale) + align;
  let y = (pos.y / globals.physics_scale) + align;

  return u32(y * globals.size + x);
}

fn getNeighbours(grid_index: u32) -> array<u32> {
  // get particles from all 9 cells
  // TODO implement
  return array<i32, 3>(1, 2, 3)
}

fn distanceSquared(v : vec2i) -> i32 {
  // TODO implement, for now returning something that always misses
  return globals.physics_scale * 2;
}

//returns vector between particles and distance_squared if it collides
fn collides(p1: Particle, p2: Particle) -> (bool, vec2i, i32) {
  // TODO: implement, for now not colliding
  return (false, vec2i(0, 0), 0)
}

// returns the amount of displacement for the particle
// TODO: potential optimization as we also know the displacement of the other particle.
// if other particle index < this particle index, we have already calculated for both.
fn bounce(diff: vec2i, magnitude_squared: i32) -> vec2i {
  return vec2i(1,1);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if(id.x >= arrayLength(&particles)){return;}

    let particle_index = id.x;
    let p = particles[particle_index];
    let grid_index = gridIndex(p.position);

    let neighbours = getNeighbours(grid_index);

    for (var i: u32 = 0; i < arrayLength(neighbours); i = i + 1) {
      let n_index = neighbours[i]; // get neighbour index
      let n = particles[n_index];
      
      var (collides, diff, magnitude_squared) = collides(p, n);
      if(!collides) {continue;}

      var displacement = bounce(diff, magnitude_squared);

      // set displacement values in buffer
      // Use atomicAdd to ensure safe writing
      let displacement_index = particle_index * 2;
      atomicAdd(&particle_displacement[displacement_index], displacement.x);
      atomicAdd(&particle_displacement[displacement_index + 1], displacement.y);
    }
}

// radius == physicsScale

//const dot1Pos = this.reuseVec1.setXY(x, y)
  //   const dot2Pos = this.reuseVec2.setXY(x2, y2)
  //   const dot1Radius = this.radius
  //   const dot2Radius = this.radius
  //   const vec = dot1Pos.subVec(dot2Pos)
  //   const disSq = vec.magSq()
  //   const disMin = dot1Radius + dot2Radius
  //   const disMinSq = disMin * disMin
  //   if (disSq < disMinSq) {
  //     // we are colliding
  //     const dist = Math.sqrt(disSq)
  //     const normal = vec.divNr(dist)
  //     const dot1Mass = this.mass
  //     const dot2Mass = this.mass
  //     const totalMass = dot1Mass + dot2Mass
  //     const dot1MassEffect = dot1Mass / totalMass
  //     const dot2MassEffect = dot2Mass / totalMass
  //     const coeff = 0.75
  //     const delta = 0.5 * coeff * (dist - disMin)
  //     // Update positions
  //     this.reuseVec2.setVec(normal)
  //     const dot1Translation = normal.mul(-dot2MassEffect * delta)
  //     const dot2Translation = this.reuseVec2.mul(dot1MassEffect * delta)
  //     this.reuseResult.x1 = dot1Translation.x
  //     this.reuseResult.y1 = dot1Translation.y
  //     this.reuseResult.x2 = dot2Translation.x
  //     this.reuseResult.y2 = dot2Translation.y

  //     return this.reuseResult
  //   }
  // }


`