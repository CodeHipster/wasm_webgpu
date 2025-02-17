export default /* wgsl */`
  struct Particle {
    position: vec2<f32>,
    prevPosition: vec2<f32>,
  };

  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    
    let dt: f32 = 0.016; // Assume ~60 FPS
    let gravity: vec2<f32> = vec2<f32>(0.0, -9.8); // accelerate with 10 units per second
    
    var p = particles[i];
    
    // Verlet integration step
    let temp = p.position;
    p.position = 2.0 * p.position - p.prevPosition + gravity * dt * dt;
    p.prevPosition = temp;

    // Apply boundary constraints (keep particles inside a 2x2 box)
    p.position = clamp(p.position, vec2<f32>(0.0), vec2<f32>(1000.0));

    particles[i] = p;
  }
`