export default /*wgsl*/`
  struct GlobalVars {
    gravity: vec2i, // (x,y) acceleration
    min: i32,
    max: i32,
    physics_scale: i32, // for scaling down to grid size
    render_scale: i32, // for scaling down to clip_space
    sps_2: i32, // steps per second squared
    size: i32, // size of the simulation
  };

  struct Particle {
    position: vec2<i32>,
    prev_position: vec2<i32>,
  };

  @group(0) @binding(0) var<storage, read> particles: array<Particle>;
  @group(0) @binding(1) var<uniform> globals: GlobalVars;

  struct VertexOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) color: vec4<f32>,
  };

  @vertex
  fn vs_main(@builtin(vertex_index) index: u32) -> VertexOutput {
      var out: VertexOutput;
      let pos = particles[index].position; 
      // Scale to clip space [-1,1]
      let f_pos = vec2f(f32(pos.x), f32(pos.y)) / f32(globals.render_scale); //possibly losing some precision here, but that should not affect where the particle ends up on screen too much.
      out.position = vec4<f32>(f_pos, 0.0, 1.0); // Normalize to clip space
      out.color = vec4<f32>(1.0, 1.0, 1.0, 1.0); // White
      return out;
  }

  @fragment
  fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
      return in.color;
  }
`