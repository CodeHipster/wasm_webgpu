import GlobalsBuffer from "./globals-buffer.js";
import ParticleBuffer from "./particle-buffer.js";
import CollisionPass from "./passes/collision-pass.js";
import DisplacementPass from "./passes/displacement-pass.js";
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

    this.particleBuffer = new ParticleBuffer(device, particleCount, range, min, max, physicsScale);
    const particleDeviceBuffer = this.particleBuffer.buffer;
    this.particleBuffer.debug(physicsScale)

    this.gravityPass = new GravityPass(device, globalsBuffer, particleDeviceBuffer, workgroupCount);
    this.renderPass = new RenderPass(device, textureFormat, globalsBuffer, particleDeviceBuffer, particleCount);

    this.gridSortPass = new GridSortPass(device, globalsBuffer, particleDeviceBuffer, workgroupCount, size, particlesPerCell)
    this.gridSortPass.debug()

    const gridBuffer = this.gridSortPass.gridBuffer;
    const gridCountBuffer = this.gridSortPass.gridCountBuffer;
    this.collisionPass = new CollisionPass(device, globalsBuffer, particleDeviceBuffer, gridBuffer, gridCountBuffer, particleCount, workgroupCount);
    this.collisionPass.debug(physicsScale)

    this.displacementPass = new DisplacementPass(device, this.collisionPass.displacementBuffer, particleDeviceBuffer, workgroupCount);
  }

  start() {
    // setInterval(this.physicsLoop, 1000 / this.stepsPerSecond)

    // single step for debugging
    this.physicsLoop()
  }

  // Separate physics loop from rendering, so they can run independently.
  // The render loop is tied to the requestAnimationFrame
  // The physics loop has no dependency. But we want to have a higher call rate to have less artifacts in the physics.
  physicsLoop = async () => {
    const commandEncoder = this.device.createCommandEncoder();

    // Gravity pass 
    this.gravityPass.pass(commandEncoder);

    // Grid sort pass
    this.gridSortPass.pass(commandEncoder);

    // Collision pass
    this.collisionPass.pass(commandEncoder);

    // Displacement pass
    this.displacementPass.pass(commandEncoder);

    // copy debug buffers. Informing the gpu to copy the data to the debug buffer.
    this.particleBuffer.copy(commandEncoder);

    this.device.queue.submit([commandEncoder.finish()]);

    // Debug logging, we have to log after finishing the command encoder. 
    // This will make sure the debug buffers are read after the physics logic is applied and the debug buffers are filled.
    await this.particleBuffer.debugLog();
    await this.gridSortPass.debugLog();
    await this.collisionPass.debugLog();
  }

  render(context) {
    const commandEncoder = this.device.createCommandEncoder();

    // Render Pass (Draw Particles)
    this.renderPass.pass(commandEncoder, context);

    this.device.queue.submit([commandEncoder.finish()]);  
  }
}