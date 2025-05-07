const shader = /* wgsl */`
  struct GlobalVars {
    gravity: vec2i, // (x,y) acceleration
    min: i32,
    max: i32,
    render_scale: i32, // for scaling down to clip_space
    sps_2: i32, // steps per second squared
    size: i32, // size of the simulation
  };

  struct Particle {
    position: vec2f,
    prev_position: vec2f,
  };

  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
  @group(0) @binding(1) var<uniform> globals: GlobalVars;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if(id.x >= arrayLength(&particles)){return;}
    let i = id.x;
        
    var p = particles[i];
    
    // Verlet integration step
    let temp = p.position;
    p.position = p.position + (p.position - p.prev_position) + vec2f(globals.gravity) / f32(globals.sps_2); // gravity(in seconds) multiplied by time passed^2 in seconds. (or divide by steps per second squared to stay in integers)
    p.prev_position = temp;

    // Apply boundary constraints (keep particles inside a the box)
    p.position = clamp(p.position, vec2f(f32(globals.min) + 0.5), vec2f(f32(globals.max) - 0.5)); // keep half a pixel away from border

    particles[i] = p;
  }
`;

// This pass updates the particle position based on previous positions
// And applies gravity forces
// Then clips it to within the bounding box
export default class GravityPass {

  constructor(device, globalsBuffer, particleBuffer, workgroupCount) {
    this.pipeline = this._pipeline(device);
    this.bindGroup = this._bindGroup(device, globalsBuffer, particleBuffer.gpuBuffer(), this.pipeline);
    this.particleBuffer = particleBuffer;
    this.particleDebugBuffer = particleBuffer.buildDebugBuffer("gravity-pass");
    this.workgroupCount = workgroupCount;
  }

  pass(commandEncoder) {
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.workgroupCount);
    pass.end();
    
    if(this.debug){
      commandEncoder.copyBufferToBuffer(this.particleBuffer.gpuBuffer(), 0, this.particleDebugBuffer.gpuBuffer(), 0, this.particleDebugBuffer.gpuBuffer().size);
    }
  }

  debug(on) {
    this._debug = on;
  }

  async debugLog() {
    this.particleDebugBuffer.debugLog("gravity-pass")
  }

  _pipeline(device) {
    const module = device.createShaderModule({
      label: 'gravity-pass.js',
      code: shader,
    });

    return device.createComputePipeline({
      layout: "auto",
      compute: { module: module, entryPoint: "main" }
    });
  }

  _bindGroup(device, globalsBuffer, particleBuffer, pipeline) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: globalsBuffer } }]
    });
  }
}