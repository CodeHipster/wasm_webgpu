export default /* wgsl */`
  struct GlobalVars {
    gravity: vec2f, // (x,y) acceleration
    size: f32,
    halfSize: f32,
  };

  struct Particle {
    position: vec2<f32>,
    prevPosition: vec2<f32>,
  };

  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
  @group(0) @binding(1) var<uniform> globals: GlobalVars;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    
    let dt: f32 = 0.016; // Assume ~60 FPS
    
    var p = particles[i];
    
    // Verlet integration step
    let temp = p.position;
    p.position = 2.0 * p.position - p.prevPosition + globals.gravity * dt * dt;
    p.prevPosition = temp;

    // Apply boundary constraints (keep particles inside a the box)
    p.position = clamp(p.position, vec2<f32>(0.0), vec2<f32>(globals.size));

    particles[i] = p;
  }
`