export default /*wgsl*/`
  struct GlobalVars {
    gravity: vec2f,
    size: f32,
    halfSize: f32,
  };

  struct Particle {
    position: vec2<f32>,
    prevPosition: vec2<f32>,
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
      var pos = (particles[index].position / globals.halfSize) - vec2f(1.0, 1.0); // Scale to clip space [-1,1]
      out.position = vec4<f32>(pos, 0.0, 1.0); // Normalize to clip space
      out.color = vec4<f32>(1.0, 1.0, 1.0, 1.0); // White
      return out;
  }

  @fragment
  fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
      return in.color;
  }
`