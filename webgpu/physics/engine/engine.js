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
    this._speed = 100; // speed on which the simulation runs
    this.step = 0;

    const workgroupCount = this.particleCount / 64 + 1

    const gravity = [0, 0];
    // const gravity = [0, -10 * physicsScale]
    const globalsBuffer = new GlobalsBuffer(device, gravity, size, physicsScale, renderScale, min, max, this.stepsPerSecond).buffer;

    this.particleBuffer = new ParticleBuffer(device, particleCount, range, min, max, physicsScale);
    const particleDeviceBuffer = this.particleBuffer.buffer;
    const colorBuffer = this.particleBuffer.colorBuffer;


    this.gravityPass = new GravityPass(device, globalsBuffer, particleDeviceBuffer, workgroupCount);
    this.renderPass = new RenderPass(device, textureFormat, globalsBuffer, particleDeviceBuffer, colorBuffer, particleCount);

    this.gridSortPass = new GridSortPass(device, globalsBuffer, particleDeviceBuffer, workgroupCount, size, particlesPerCell)

    const gridBuffer = this.gridSortPass.gridBuffer;
    const gridCountBuffer = this.gridSortPass.gridCountBuffer;
    this.collisionPass = new CollisionPass(device, globalsBuffer, particleDeviceBuffer, gridBuffer, gridCountBuffer, particleCount, workgroupCount);

    this.displacementPass = new DisplacementPass(device, this.collisionPass.displacementBuffer, particleDeviceBuffer, workgroupCount);
  }

  running(){
    return (this.physicsInterval == true)
  }

  debug(on) {
    this._debug = on;
    this.gridSortPass.debug(on)
    this.particleBuffer.debug(on)
    this.collisionPass.debug(on, this.physicsScale)
  }

  speed(percentage) {
    this._speed = percentage;
    if(this.physicsInterval){
      clearInterval(this.physicsInterval);
      this.start();
    }
  }

  start() {
    this.physicsInterval = setInterval(this.physicsLoop, (1000 / (this.stepsPerSecond * (this._speed / 100))));

    // single step for debugging
    // this.physicsLoop()
  }

  stop() {
    clearInterval(this.physicsInterval);
    this.physicsInterval = undefined;
  }

  singleStep() {
    if (!this.physicsInterval) { // if not running
      this.physicsLoop();
    }
  }

  stepTo(target){
    if (!this.physicsInterval && target > this.step) { // if not running
      // disable debug while quickstepping
      const prevDebug = this._debug
      this.debug(false)
      const steps = target - this.step;
      for (let i = 0; i < steps; i++) {
        this.physicsLoop();
      }
      this.debug(prevDebug)
    }
  }

  // Separate physics loop from rendering, so they can run independently.
  // The render loop is tied to the requestAnimationFrame
  // The physics loop has no dependency. But we want to have a higher call rate to have less artifacts in the physics.
  physicsLoop = async () => {
    this.step++;
    const commandEncoder = this.device.createCommandEncoder();

    // Gravity pass 
    this.gravityPass.pass(commandEncoder);

    // Grid sort pass
    this.gridSortPass.pass(commandEncoder);

    // Collision pass
    this.collisionPass.pass(commandEncoder);

    // Displacement pass
    this.displacementPass.pass(commandEncoder);

    if (this._debug) {
      // copy debug buffers. Informing the gpu to copy the data to the debug buffer.
      this.particleBuffer.copy(commandEncoder);
    }

    this.device.queue.submit([commandEncoder.finish()]);

    if (this._debug) {
      console.log(`\nStep: ${this.step}`)
      // Debug logging, we have to log after finishing the command encoder. 
      // This will make sure the debug buffers are read after the physics logic is applied and the debug buffers are filled.
      await this.particleBuffer.debugLog();
      await this.gridSortPass.debugLog();
      await this.collisionPass.debugLog();
    }
  }

  render(context) {
    const commandEncoder = this.device.createCommandEncoder();

    // Render Pass (Draw Particles)
    this.renderPass.pass(commandEncoder, context);

    this.device.queue.submit([commandEncoder.finish()]);
  }
}