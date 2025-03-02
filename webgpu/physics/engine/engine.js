import particleGravityWGSL from "./shader/particle-gravity.js";
import gridSortWGSL from "./shader/grid-sort.js";
import particleShaderWGSL from "./shader/particle-shader.js";

export default class Engine {

  constructor(device, textureFormat, particleCount, size) {
    this.device = device;
    this.particleCount = particleCount;
    // scaling to be able to use only i32 instead of floats.
    // This will give a 286_000_000 buffer before they over/underflow
    const range = 4_000_000_000; // close to max u32
    // const range = Math.pow(2, 23) // within the float precision scale
    const physicsScale = range / size; // the size of a pixel
    const renderScale = range / 2; // to scale position back into clip space (-1,1)
    const min = range / -2;
    const max = range / 2;
    this.stepsPerSecond = 256 // run the verlet integrator at 256 frames per second
    const stepsPerSecondSquared = this.stepsPerSecond*this.stepsPerSecond 

    const globalsBuffer = this._globalsBuffer(size, physicsScale, renderScale, min, max, stepsPerSecondSquared);
    this.particleBuffer = this._particleBuffer(range, max);
    this.debugBuffer = this._debugBuffer(this.particleBuffer);

    this.gravityPipeline = this._gravityPipeline()
    this.computeBindGroup = this._gravityBindGroup(globalsBuffer, this.particleBuffer, this.gravityPipeline);
    this.renderPipeline = this._renderPipeline(textureFormat);
    this.renderBindGroup = this._renderBindGroup(globalsBuffer, this.particleBuffer, this.renderPipeline);

    this.gridBuffer = this._gridBuffer(size, 30)
    this.gridCountBuffer = this._gridCountBuffer(size)
    this.sortPipeline = this._sortPipeline()
    this.sortBindGroup = this._sortBindGroup(globalsBuffer, this.particleBuffer, this.gridBuffer, this.gridCountBuffer, this.sortPipeline);
  }

  start() {
    setInterval(this.physicsLoop, 1000/this.stepsPerSecond)
  }

  physicsLoop = () =>{
    const commandEncoder = this.device.createCommandEncoder();

    // Gravity pass 
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.gravityPipeline);
      pass.setBindGroup(0, this.computeBindGroup);
      pass.dispatchWorkgroups(this.particleCount / 64 + 1);
      pass.end();
    }

    // For debugging particle positions
    // Encode a command to copy the results to a mappable buffer.
    // commandEncoder.copyBufferToBuffer(this.particleBuffer, 0, this.debugBuffer, 0, this.debugBuffer.size);

    // Grid sort pass
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.sortPipeline);
      pass.setBindGroup(0, this.sortBindGroup);
      pass.dispatchWorkgroups(this.particleCount / 64 + 1);
      pass.end();
    }

    this.device.queue.submit([commandEncoder.finish()]);
    
      // Read the debug buffer
    // await debugBuffer.mapAsync(GPUMapMode.READ);
    // const debug = new Int32Array(debugBuffer.getMappedRange().slice()); //copy data
    // debugBuffer.unmap(); // give control back to gpu
    // console.log("debug: x: "+debug[0]/ physicsScale, "y: " + debug[1]/ physicsScale)
    
  }

  render(context) {
    const commandEncoder = this.device.createCommandEncoder();

    // Render Pass (Draw Particles)
    {
      const textureView = context.getCurrentTexture().createView();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: [0, 0, 0, 1] // Black background
        }]
      });

      pass.setPipeline(this.renderPipeline);
      pass.setBindGroup(0, this.renderBindGroup);
      pass.setVertexBuffer(0, this.particleBuffer);
      pass.draw(this.particleCount);
      pass.end();
    }

    this.device.queue.submit([commandEncoder.finish()]);
    
  }

  _gravityPipeline() {
    const gravityModule = this.device.createShaderModule({
      label: 'particle-gravity.js',
      code: particleGravityWGSL,
    });

    return this.device.createComputePipeline({
      layout: "auto",
      compute: { module: gravityModule, entryPoint: "main" }
    });
  }

  _gravityBindGroup(globalsBuffer, particleBuffer, gravityPipeline) {
    return this.device.createBindGroup({
      layout: gravityPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: globalsBuffer } }]
    });
  }

  _sortPipeline() {
    const module = this.device.createShaderModule({
      label: 'grid-sort.js',
      code: gridSortWGSL,
    });

    return this.device.createComputePipeline({
      layout: "auto",
      compute: { module: module, entryPoint: "main" }
    });
  }

  _sortBindGroup(globalsBuffer, particleBuffer, grid, gridCount, pipeline) {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: globalsBuffer } },
        { binding: 2, resource: { buffer: grid } },
        { binding: 3, resource: { buffer: gridCount } },
      ]
    });
  }

  _renderPipeline(textureFormat) {
    const renderModule = this.device.createShaderModule({
      label: 'particle-shader.js',
      code: particleShaderWGSL,
    });

    return this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: renderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: renderModule,
        entryPoint: "fs_main",
        targets: [{ format: textureFormat }]
      },
      primitive: { topology: "point-list" } // Telling webgpu that our vertexes are points and don't need triangle interpolation for the fragment shader
    });
  }

  _renderBindGroup(globalsBuffer, particleBuffer, renderPipeline) {
    return this.device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: globalsBuffer } }]
    });
  }

  _particleBuffer(range, max) {
    // Create particle buffer (shared between compute & render)
    const bufferSize = this.particleCount * 4 * 2 * 2; // 4 ints for x,y, current pos and previous pos
    const particleBuffer = this.device.createBuffer({
      label: 'particle buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Initialize particle positions
    let particleData = new Int32Array(this.particleCount * 4);
    for (let i = 0; i < this.particleCount; i++) {
      var x = Math.random() * range - max; // x in [min, max]
      var y = Math.random() * range - max; // y in [min, max]
      // Store as flat data in an array
      // position
      particleData[i * 4] = x;
      particleData[i * 4 + 1] = y;
      // previousPosition, start at the same location, which means there is no initial velocity.
      particleData[i * 4 + 2] = x;
      particleData[i * 4 + 3] = y;
    }
    // console.log("x: "+particleData[0]/ physicsScale, "y: " + particleData[1]/ physicsScale)
    this.device.queue.writeBuffer(particleBuffer, 0, particleData);

    return particleBuffer;
  }

  _debugBuffer(particleBuffer) {
    // create a buffer on the GPU to get a copy of the results
    const bufferSize = this.particleCount * 4 * 2 * 2; // 4 ints for x,y, current pos and previous pos
    return this.device.createBuffer({
      label: 'debug buffer',
      size: particleBuffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }

  _globalsBuffer(size, physicsScale, renderScale, min, max, stepsPerSecondSquared) {
    // Create uniform with global variables
    const globalsBufferSize =
      2 * 4 + // gravity is 2 i32 (4bytes each)
      2 * 4 + // min, max are i32
      2 * 4 +// scales are i32
      4 + // steps per second
      4 // Size
      ;
    const globalsBuffer = this.device.createBuffer({
      label: 'globals buffer',
      size: globalsBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // create a typedarray to hold the values for the uniforms in JavaScript
    const globals = new Int32Array(globalsBufferSize / 4);

    // set the values in the correct place for the uniform struct in wgsl.
    globals.set([0, -10 * physicsScale], 0) // gravity
    globals.set([min, max], 2) // min and max position bounds
    globals.set([physicsScale, renderScale], 4) // scale
    globals.set([stepsPerSecondSquared], 6) 
    globals.set([size], 7) 
    console.log(globals)

    // queue writing globals to the buffer
    this.device.queue.writeBuffer(globalsBuffer, 0, globals);

    return globalsBuffer;
  }

  // TODO: particles per cell in global var.
  // stores indexes to particles per cell
  _gridBuffer(size, particlesPerCell){
    return this.device.createBuffer({
      label: 'grid buffer',
      size: 4 * size * size * particlesPerCell,
      usage: GPUBufferUsage.STORAGE,
    });
  }

  // stores the nr of particles in a given cell as u32
  _gridCountBuffer(size){
    return this.device.createBuffer({
      label: 'gridCount buffer',
      size: 4 * size * size,
      usage: GPUBufferUsage.STORAGE,
    });
  }

}