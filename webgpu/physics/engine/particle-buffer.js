export default class ParticleBuffer {
  constructor(device, particleCount, range, max) {
    this.buffer = this._buffer(device, particleCount, range, max);
    this.debugBuffer = this._debugBuffer(device, this.buffer)
  }

  debug(physicsScale) {
    this.physicsScale = physicsScale;
    this._debug = true;
  }

  async copy(commandEncoder) {
    if (!this._debug) {
      console.log("debug not enabled on ParticleBuffer")
      return;
    }
    commandEncoder.copyBufferToBuffer(this.buffer, 0, this.debugBuffer, 0, this.debugBuffer.size);
  }

  async logBuffer() {
    if (!this._debug) {
      console.log("debug not enabled on ParticleBuffer")
      return;
    }

    console.log("logging particles")
    await this.debugBuffer.mapAsync(GPUMapMode.READ);
    const debugParticle = new Int32Array(this.debugBuffer.getMappedRange().slice()); //copy data
    this.debugBuffer.unmap(); // give control back to gpu
    for (let i = 0; i < debugParticle.length; i = i + 4) {
      console.log("x: " + debugParticle[i] / this.physicsScale, "y: " + debugParticle[i + 1] / this.physicsScale)
    }
  }

  _buffer(device, particleCount, range, max) {
    // Create particle buffer (shared between compute & render)
    const bufferSize = particleCount * 4 * 2 * 2; // 4 ints for x,y, current pos and previous pos
    const particleBuffer = device.createBuffer({
      label: 'particle buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Initialize particle positions
    let particleData = new Int32Array(particleCount * 4);
    for (let i = 0; i < particleCount; i++) {
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
    device.queue.writeBuffer(particleBuffer, 0, particleData);

    return particleBuffer;
  }

  _debugBuffer(device, particleBuffer) {
    // create a buffer on the GPU to get a copy of the results
    return device.createBuffer({
      label: 'particle debug buffer',
      size: particleBuffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }
}