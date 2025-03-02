export default /* wgsl */`
  struct GlobalVars {
    gravity: vec2i, // (x,y) acceleration
    min: i32,
    max: i32,
    physics_scale: i32, // for scaling down to grid size
    rander_scale: i32, // for scaling down to clip_space
    sps_2: i32, // steps per second squared
    size: i32, // size of the simulation
  };

  struct Particle {
    position: vec2<i32>,
    prev_position: vec2<i32>,
  };

  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
  @group(0) @binding(1) var<uniform> globals: GlobalVars;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
        
    var p = particles[i];
    
    // Verlet integration step
    let temp = p.position;
    p.position = p.position + (p.position - p.prev_position) + (globals.gravity / globals.sps_2); // gravity(in seconds) multiplied by time passed^2 in seconds. (or devide by steps per second squared to stay in integers)
    p.prev_position = temp;

    // Apply boundary constraints (keep particles inside a the box)
    p.position = clamp(p.position, vec2<i32>(globals.min), vec2<i32>(globals.max));

    particles[i] = p;
  }
`