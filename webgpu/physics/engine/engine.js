import GlobalsBuffer from "./globals-buffer.js";
import ParticleBuffer from "./particle-buffer.js";
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
    const particlesPerCell = 30;
    // const range = Math.pow(2, 23) // within the float precision scale
    const physicsScale = range / size; // the size of a pixel
    this.physicsScale = physicsScale;
    const renderScale = range / 2; // to scale position back into clip space (-1,1)
    const min = range / -2;
    const max = range / 2;
    this.stepsPerSecond = 256 // run the verlet integrator at 256 frames per second

    const workgroupCount = this.particleCount / 64 + 1

    const globalsBuffer = new GlobalsBuffer(device, size, physicsScale, renderScale, min, max, this.stepsPerSecond).buffer;
    this.particleBuffer = new ParticleBuffer(device, particleCount, range, max).buffer;
    this.gravityPass = new GravityPass(device, globalsBuffer, this.particleBuffer, workgroupCount);
    this.renderPass = new RenderPass(device, textureFormat, globalsBuffer, this.particleBuffer, particleCount);
    this.gridSortPass = new GridSortPass(device, globalsBuffer, this.particleBuffer, workgroupCount, size, particlesPerCell)
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

  // TODO: move logging to specific passes
  // _logParticles(particles){
  //   console.log("logging particles")
  //   for(let i = 0; i< particles.length; i = i + 4){
  //     console.log("x: "+particles[i]/ this.physicsScale, "y: " + particles[i+1]/ this.physicsScale)
  //   }
  // }

  // // first particle has index 0
  // _logParticlesInGrid(debugGrid) {
  //   console.log("logging grid")
  //   for (const [index, value] of debugGrid.entries()) {
  //     if(value == 0) continue;
  //     const cell = Math.floor(index/30) // do we need to floor?
  //     const x = cell % this.size;
  //     const y = Math.floor(cell / this.size);
  //     console.log(`cell: ${cell}, x: ${x}, y: ${y}, value:${value}`);
  //   }
  // }

  // _logGridParticleCount(debugGridCount) {
  //   console.log("logging grid count")
  //   for (const [index, value] of debugGridCount.entries()) {
  //     if(value == 0) continue;
  //     const x = index % this.size;
  //     const y = Math.floor(index / this.size);
  //     console.log(`x: ${x}, y: ${y}, value:${value}`);
  //   }
  // }
}