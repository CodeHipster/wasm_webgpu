export default /* wgsl */`
  struct GlobalVars {
    gravity: vec2i, // (x,y) acceleration
    min: i32,
    max: i32,
    physics_scale: i32, // for scaling down to grid size
    rander_scale: i32, // for scaling down to clip_space
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
    p.position = p.position + (p.position - p.prev_position) + (globals.gravity / 3600); // 3600 = 60fps * 60fps
    p.prev_position = temp;

    // Apply boundary constraints (keep particles inside a the box)
    p.position = clamp(p.position, vec2<i32>(globals.min), vec2<i32>(globals.max));

    particles[i] = p;
  }
`