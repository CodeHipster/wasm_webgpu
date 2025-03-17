const shader = /* wgsl */`
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
  }

  struct Displacement {
    x: atomic<i32>,
    y: atomic<i32>
  }

  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
  @group(0) @binding(1) var<storage, read_write> particle_displacement: array<Displacement>; // Particle displacement 2 ints for each particle. x & y
  @group(0) @binding(2) var<uniform> globals: GlobalVars;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if(id.x >= arrayLength(&particles)){return;}
    let i = id.x;

    let displacement = vec2i(atomicLoad(&particle_displacement[i].x), atomicLoad(&particle_displacement[i].y));

    let position = particles[i].position + displacement;
    // Apply boundary constraints (keep particles inside a the box)
    particles[i].position = clamp(position, vec2<i32>(globals.min + globals.physics_scale/2), vec2<i32>(globals.max - globals.physics_scale/2));
    particles[i].position = bounce_border(particles[i]);
  }

  // push back a little when exactly on the border, to avoid stacking
  fn bounce_border(particle: Particle) -> vec2i {
    var pos = particle.position;
    if(pos.x == (globals.max - globals.physics_scale/2)){ 
      pos.x = pos.x - (globals.physics_scale / 128);
    } else if(pos.x == (globals.min + globals.physics_scale/2)){ 
      pos.x = pos.x + (globals.physics_scale / 128);
    }
  
    if(pos.y == (globals.max - globals.physics_scale/2)){ 
      pos.y = pos.y - (globals.physics_scale / 128);
    } else if(pos.y == (globals.min + globals.physics_scale/2)){ 
      pos.y = pos.y + (globals.physics_scale / 128);
    }
    return pos;
  }
`;

// This pass applies displacements from collision 
// and then clips the position to within the bounding box.
export default class DisplacementPass {

  constructor(device, globalsBuffer, displacementBuffer, particleBuffer, workgroupCount) {
    this.pipeline = this._pipeline(device);
    this.particleBuffer = particleBuffer;
    this.particleDebugBuffer = particleBuffer.buildDebugBuffer("displacement-pass");
    this.bindGroup = this._bindGroup(device, globalsBuffer, displacementBuffer, particleBuffer.gpuBuffer(), this.pipeline);
    this.workgroupCount = workgroupCount;
  }

  pass(commandEncoder) {
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.workgroupCount);
    pass.end();

    if (this.debug) {
      commandEncoder.copyBufferToBuffer(this.particleBuffer.gpuBuffer(), 0, this.particleDebugBuffer.gpuBuffer(), 0, this.particleDebugBuffer.gpuBuffer().size);
    }
  }

  debug(on) {
    this._debug = on;
  }

  async debugLog() {
    this.particleDebugBuffer.debugLog("displacement-pass")
  }

  _pipeline(device) {
    const module = device.createShaderModule({
      label: 'displacement-pass.js',
      code: shader,
    });

    return device.createComputePipeline({
      layout: "auto",
      compute: { module: module, entryPoint: "main" }
    });
  }

  _bindGroup(device, globalsBuffer, displacementBuffer, particleBuffer, pipeline) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: displacementBuffer } },
        { binding: 2, resource: { buffer: globalsBuffer } },
      ]
    });
  }
}
