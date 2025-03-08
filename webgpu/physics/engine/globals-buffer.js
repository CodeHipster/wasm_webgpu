// TODO: split globals up in multiple buffers that better match the compute & render passes;
export default class GlobalsBuffer{

  constructor(device, size, physicsScale, renderScale, min, max, stepsPerSecond){
    const stepsPerSecondSquared = stepsPerSecond * stepsPerSecond;
    this.buffer = this._buffer(device, size, physicsScale, renderScale, min, max, stepsPerSecondSquared)
  }

  _buffer(device, size, physicsScale, renderScale, min, max, stepsPerSecondSquared) {
    // Create uniform with global variables
    const globalsBufferSize =
      2 * 4 + // gravity is 2 i32 (4bytes each)
      2 * 4 + // min, max are i32
      2 * 4 +// scales are i32
      4 + // steps per second
      4 // Size
      ;
    const globalsBuffer = device.createBuffer({
      label: 'globals buffer',
      size: globalsBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // create a typedarray to hold the values for the uniforms in JavaScript
    const globals = new Int32Array(globalsBufferSize / 4);

    // set the values in the correct place for the uniform struct in wgsl.
    globals.set([0, -10 * physicsScale], 0) // gravity
    // TODO: make gravity configurable.
    // globals.set([0, 0 * physicsScale], 0) // gravity
    globals.set([min, max], 2) // min and max position bounds
    globals.set([physicsScale, renderScale], 4) // scale
    globals.set([stepsPerSecondSquared], 6)
    globals.set([size], 7)
    console.log(globals)

    // queue writing globals to the buffer
    device.queue.writeBuffer(globalsBuffer, 0, globals);

    return globalsBuffer;
  }
}