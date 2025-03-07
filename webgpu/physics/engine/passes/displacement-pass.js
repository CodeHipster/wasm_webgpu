const shader = /* wgsl */`

  struct Particle {
    position: vec2<i32>,
    prev_position: vec2<i32>,
  };

  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
  @group(0) @binding(1) var<storage, read_write> particle_displacement: array<atomic<i32>>; // Particle displacement 2 ints for each particle. x & y

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if(id.x >= arrayLength(&particles)){return;}
    let i = id.x;

    let displacement = vec2i(atomicLoad(&particle_displacement[i * 2]), atomicLoad(&particle_displacement[i * 2 + 1]));
        
    particles[i].position = particles[i].position + displacement;
  }
`;

export default class DisplacementPass {

  constructor(device, displacementBuffer, particleBuffer, workgroupCount) {
    this.pipeline = this._pipeline(device);
    this.bindGroup = this._bindGroup(device, displacementBuffer, particleBuffer, this.pipeline);
    this.workgroupCount = workgroupCount;
  }

  pass(commandEncoder) {
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.workgroupCount);
    pass.end();
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

  _bindGroup(device, displacementBuffer, particleBuffer, pipeline) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: displacementBuffer } }]
    });
  }
}
