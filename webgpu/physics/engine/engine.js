

import GravityPass from "./passes/gravity-pass.js";
import GridSortPass from "./passes/grid-sort-pass.js";
import RenderPass from "./passes/render-pass.js";

export default class Engine {

  constructor(device, textureFormat, particleCount, size) {
    this.size = size
    this.device = device;
    this.particleCount = particleCount;
    // scaling to be able to use only i32 instead of floats.
    // This will give a 286_000_000 buffer before they over/underflow
    const range = 4_000_000_000; // close to max u32
    // const range = Math.pow(2, 23) // within the float precision scale
    const physicsScale = range / size; // the size of a pixel
    this.physicsScale = physicsScale;
    const renderScale = range / 2; // to scale position back into clip space (-1,1)
    const min = range / -2;
    const max = range / 2;
    this.stepsPerSecond = 256 // run the verlet integrator at 256 frames per second
    const stepsPerSecondSquared = this.stepsPerSecond * this.stepsPerSecond

    const workgroupCount = this.particleCount / 64 + 1

    const globalsBuffer = this._globalsBuffer(size, physicsScale, renderScale, min, max, stepsPerSecondSquared);
    this.particleBuffer = this._particleBuffer(range, max);
    this.particleDebugBuffer = this._particleDebugBuffer(this.particleBuffer);

    this.gravityPass = new GravityPass(device, globalsBuffer, this.particleBuffer, workgroupCount);
    this.renderPass = new RenderPass(device, textureFormat, globalsBuffer, this.particleBuffer, particleCount);

    this.gridBuffer = this._gridBuffer(size, 30)
    this.gridDebugBuffer = this._gridDebugBuffer(this.gridBuffer);
    this.gridCountBuffer = this._gridCountBuffer(size)
    this.gridCountDebugBuffer = this._gridCountDebugBuffer(this.gridCountBuffer)

    this.gridSortPass = new GridSortPass(device, globalsBuffer, this.particleBuffer, this.gridBuffer, this.gridCountBuffer, workgroupCount)
  }

  start() {
    setInterval(this.physicsLoop, 1000 / this.stepsPerSecond)

    // single step for debugging
    // setTimeout(this.physicsLoop, 1000)
  }

  physicsLoop = async () => {
    const commandEncoder = this.device.createCommandEncoder();

    // Gravity pass 
    this.gravityPass.pass(commandEncoder)

    // For debugging particle positions
    // Encode a command to copy the results to a mappable buffer.
    // commandEncoder.copyBufferToBuffer(this.particleBuffer, 0, this.particleDebugBuffer, 0, this.particleDebugBuffer.size);

    // Grid sort pass
    this.gridSortPass.pass(commandEncoder)

    // For debugging grid
    // Encode a command to copy the results to a mappable buffer.
    // commandEncoder.copyBufferToBuffer(this.gridBuffer, 0, this.gridDebugBuffer, 0, this.gridDebugBuffer.size);
    // commandEncoder.copyBufferToBuffer(this.gridCountBuffer, 0, this.gridCountDebugBuffer, 0, this.gridCountDebugBuffer.size);

    // reset working memory
    commandEncoder.clearBuffer(this.gridBuffer);
    commandEncoder.clearBuffer(this.gridCountBuffer);

    this.device.queue.submit([commandEncoder.finish()]);

    // Read the particle debug buffer
    // await this.particleDebugBuffer.mapAsync(GPUMapMode.READ);
    // const debugParticle = new Int32Array(this.particleDebugBuffer.getMappedRange().slice()); //copy data
    // this.particleDebugBuffer.unmap(); // give control back to gpu
    // this._logParticles(debugParticle)

    // // Read the grid debug buffer
    // await this.gridDebugBuffer.mapAsync(GPUMapMode.READ);
    // const debugGrid = new Uint32Array(this.gridDebugBuffer.getMappedRange().slice()); //copy data to cpu memory
    // this.gridDebugBuffer.unmap(); // give control back to gpu
    // this._logParticlesInGrid(debugGrid)

    // // read grid Count buffer
    // await this.gridCountDebugBuffer.mapAsync(GPUMapMode.READ);
    // const debugGridCount = new Uint32Array(this.gridCountDebugBuffer.getMappedRange().slice()); //copy data to cpu memory
    // this.gridCountDebugBuffer.unmap(); // give control back to gpu
    // this._logGridParticleCount(debugGridCount)
  }

  render(context) {
    const commandEncoder = this.device.createCommandEncoder();

    // Render Pass (Draw Particles)
    this.renderPass.pass(commandEncoder, context);

    this.device.queue.submit([commandEncoder.finish()]);  
  }
  
  _logParticles(particles){
    console.log("logging particles")
    for(let i = 0; i< particles.length; i = i + 4){
      console.log("x: "+particles[i]/ this.physicsScale, "y: " + particles[i+1]/ this.physicsScale)
    }
  }

  // first particle has index 0
  _logParticlesInGrid(debugGrid) {
    console.log("logging grid")
    for (const [index, value] of debugGrid.entries()) {
      if(value == 0) continue;
      const cell = Math.floor(index/30) // do we need to floor?
      const x = cell % this.size;
      const y = Math.floor(cell / this.size);
      console.log(`cell: ${cell}, x: ${x}, y: ${y}, value:${value}`);
    }
  }

  _logGridParticleCount(debugGridCount) {
    console.log("logging grid count")
    for (const [index, value] of debugGridCount.entries()) {
      if(value == 0) continue;
      const x = index % this.size;
      const y = Math.floor(index / this.size);
      console.log(`x: ${x}, y: ${y}, value:${value}`);
    }
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
    this.device.queue.writeBuffer(particleBuffer, 0, particleData);

    return particleBuffer;
  }

  _particleDebugBuffer(particleBuffer) {
    // create a buffer on the GPU to get a copy of the results
    return this.device.createBuffer({
      label: 'particle debug buffer',
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
  _gridBuffer(size, particlesPerCell) {
    return this.device.createBuffer({
      label: 'grid buffer',
      size: 4 * size * size * particlesPerCell,
      // COPY_DST required for clearing buffer
      // COPY_SRC for copy to debug buffer
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
  }

  _gridDebugBuffer(buffer) {
    // create a buffer on the GPU to get a copy of the results
    return this.device.createBuffer({
      label: 'grid debug buffer',
      size: buffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }

  // stores the nr of particles in a given cell as u32
  _gridCountBuffer(size) {
    return this.device.createBuffer({
      label: 'gridCount buffer',
      size: 4 * size * size,
      // COPY_DST required for clearing buffer
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
  }

  // stores the nr of particles in a given cell as u32
  _gridCountDebugBuffer(buffer) {
    // create a buffer on the GPU to get a copy of the results
    return this.device.createBuffer({
      label: 'grid count debug buffer',
      size: buffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }

}