// TODO: split globals up in multiple buffers that better match the compute & render passes;
export default class GlobalsBuffer{

  constructor(device, gravity, size, renderScale, min, max, stepsPerSecond){
    const stepsPerSecondSquared = stepsPerSecond * stepsPerSecond;
    this.gravity = gravity;
    this.size = size;
    this.renderScale = renderScale;
    this.min = min;
    this.max = max;
    this.stepsPerSecond = stepsPerSecond;
    this.buffer = this._buffer(device, gravity, size, renderScale, min, max, stepsPerSecondSquared)
  }

  _buffer(device, gravity, size, renderScale, min, max, stepsPerSecondSquared) {
    // Create uniform with global variables
    const globalsBufferSize =
      2 * 4 + // gravity is 2 i32 (4bytes each)
      2 * 4 + // min, max are i32
      4 +// scale i32
      4 + // steps per second
      4 + // Size
      4 // filler to align to 16bit
      ;
    const globalsBuffer = device.createBuffer({
      label: 'globals buffer',
      size: globalsBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // create a typedarray to hold the values for the uniforms in JavaScript
    const globals = new Int32Array(globalsBufferSize / 4);

    // set the values in the correct place for the uniform struct in wgsl.
    globals.set(gravity, 0) // gravity
    globals.set([min, max], 2) // min and max position bounds
    globals.set([renderScale], 4) // scale
    globals.set([stepsPerSecondSquared], 5)
    globals.set([size], 6)

    // queue writing globals to the buffer
    device.queue.writeBuffer(globalsBuffer, 0, globals);

    return globalsBuffer;
  }

  debugLog(){
    console.log(`Global variables:
    gravity: x: ${this.gravity[0]}, y: ${this.gravity[1]}
    min-grid: ${this.min}
    max-grid: ${this.max}
    render-scale: ${this.renderScale}
    stepsPerSecond: ${this.stepsPerSecond}
    grid-size: ${this.size}`);
  }
}