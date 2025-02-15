export default /*wgsl*/`
  @group(0) @binding(0) var<storage, read> particles: array<vec2<f32>>;

  struct VertexOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) color: vec4<f32>,
  };

  @vertex
  fn vs_main(@builtin(vertex_index) index: u32) -> VertexOutput {
      var out: VertexOutput;
      out.position = vec4<f32>(particles[index], 0.0, 1.0); // Normalize to clip space
      out.color = vec4<f32>(1.0, 1.0, 1.0, 1.0); // White
      return out;
  }

  @fragment
  fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
      return in.color;
  }
`