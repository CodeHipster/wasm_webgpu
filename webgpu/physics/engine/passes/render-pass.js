const shader = /*wgsl*/`
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
  @group(0) @binding(2) var<storage, read> colors: array<vec4f>;

  struct VertexOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) color: vec4<f32>,
  };

  @vertex
  fn vs_main(@builtin(vertex_index) index: u32) -> VertexOutput {
      var out: VertexOutput;
      let particle = particles[index];
      let f_velocity = vec2f(particle.position - particle.prev_position);
      let f_dist_sq = dot(f_velocity, f_velocity);
      let f_gravity_step = vec2f(globals.gravity/(128));
      let f_gravity_sq = dot(f_gravity_step, f_gravity_step);
      // fully white when velocity > gravity
      // fully blue when velocity = 0
      let color_scale = min(f_dist_sq / f_gravity_sq, 1);
      let white = vec4f(1.0, 1.0, 1.0, 1.0);
      let blue = vec4f(0.0, 0.0, 1.0, 1.0);
      let color = colors[index];

      // Scale to clip space [-1,1]
      let f_pos = vec2f(f32(particle.position.x), f32(particle.position.y)) / f32(globals.render_scale); //possibly losing some precision here, but that should not affect where the particle ends up on screen too much.
      out.position = vec4<f32>(f_pos, 0.0, 1.0); // Normalize to clip space
      out.color = mix(blue, white, color_scale);
      return out;
  }

  @fragment
  fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
      return in.color;
  }`

export default class RenderPass {

  constructor(device, textureFormat, globalsBuffer, particleBuffer, colorBuffer, particleCount) {
    this.vertexBuffer = particleBuffer; // Using the particle buffer as input for the vertex shader
    this.particleCount = particleCount;
    this.pipeline = this._renderPipeline(device, textureFormat)
    this.bindGroup = this._renderBindGroup(device, globalsBuffer, particleBuffer, colorBuffer, this.pipeline)
  }

  pass(commandEncoder, context) {
    const textureView = context.getCurrentTexture().createView();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        loadOp: "clear",
        storeOp: "store",
        clearValue: [0, 0, 0, 1] // Black background
      }]
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.draw(this.particleCount);
    pass.end();
  }
  
  _renderPipeline(device, textureFormat) {
    const module = device.createShaderModule({
      label: 'render-pass.js',
      code: shader,
    });

    return device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: module,
        entryPoint: "vs_main",
      },
      fragment: {
        module: module,
        entryPoint: "fs_main",
        targets: [{ format: textureFormat }]
      },
      primitive: { topology: "point-list" } // Telling webgpu that our vertexes are points and don't need triangle interpolation for the fragment shader
    });
  }

  _renderBindGroup(device, globalsBuffer, particleBuffer, colorBuffer, pipeline) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: globalsBuffer } },
        { binding: 2, resource: { buffer: colorBuffer } },
      ]
    });
  }
}