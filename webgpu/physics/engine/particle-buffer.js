export default class ParticleBuffer {
  constructor(device, particleCount, range, min, max, physicsScale) {
    this.buffer = this._buffer(device, particleCount, range, min, max, physicsScale);
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

  async debugLog() {
    if (!this._debug) {
      console.log("debug not enabled on ParticleBuffer")
      return;
    }

    console.log("logging particles")
    await this.debugBuffer.mapAsync(GPUMapMode.READ);
    const debugParticle = new Int32Array(this.debugBuffer.getMappedRange().slice()); //copy data
    this.debugBuffer.unmap(); // give control back to gpu
    for (let i = 0; i < debugParticle.length; i = i + 4) {
      console.log(`index: ${i/4}, x: ${debugParticle[i] / this.physicsScale}, y:${debugParticle[i + 1] / this.physicsScale}`)
    }
  }

  _buffer(device, particleCount, range, min, max, physicsScale) {
    // Create particle buffer (shared between compute & render)
    const bufferSize = particleCount * 4 * 2 * 2; // 4 ints for x,y, current pos and previous pos
    const particleBuffer = device.createBuffer({
      label: 'particle buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Initialize particle positions
    let particleData = this._randomParticles(particleCount, range, max);
    // let particleData = this._particleCollision(particleCount, min, max, physicsScale);
    device.queue.writeBuffer(particleBuffer, 0, particleData);

    return particleBuffer;
  }

  _particleCollision(particleCount, min, max, physicsScale){
    let particleData = new Int32Array(particleCount * 4);
    let x = 0
    let y = max - physicsScale *2;

    // position
    particleData[0 * 4] = x - physicsScale * 2;
    particleData[0 * 4 + 1] = y;
    // previousPosition, moving at x unit per second.
    particleData[0 * 4 + 2] = particleData[0 * 4] - (1 * physicsScale) / 256; 
    particleData[0 * 4 + 3] = y;
    
    // position
    particleData[1 * 4] = x + physicsScale * 2;
    particleData[1 * 4 + 1] = y + physicsScale * 0.5;
    // previousPosition, moving at x unit per second.
    particleData[1 * 4 + 2] = particleData[1 * 4] + (1 * physicsScale) / 256; 
    particleData[1 * 4 + 3] = y + physicsScale * 0.5;

    return particleData;
  }
  
  _stackedParticles(particleCount, min, max, physicsScale){
    let particleData = new Int32Array(particleCount * 4);
    let x = min + physicsScale;
    let y = max - physicsScale;
    let step = physicsScale*3;
    for (let i = 0; i < particleCount; i++) {
      // Store as flat data in an array
      if( x >= max) { x = min - physicsScale; } // roll over to next line
      if( y <= min) { y = max - physicsScale; x += step;}
      // position
      particleData[i * 4] = x ;
      particleData[i * 4 + 1] = y;
      // previousPosition, start at the same location, which means there is no initial velocity.
      particleData[i * 4 + 2] = x;
      particleData[i * 4 + 3] = y;
      y -= step
    }
    return particleData;
  }

  _alignedParticles(particleCount, min, max, physicsScale){
    let particleData = new Int32Array(particleCount * 4);
    let x = min + physicsScale;
    let y = max - physicsScale;
    let step = physicsScale/2;
    for (let i = 0; i < particleCount; i++) {
      // Store as flat data in an array
      if( x >= max) { x = min - physicsScale; y -= step;} // roll over to next line
      if( y <= min) { y = max - physicsScale}
      // position
      particleData[i * 4] = x ;
      particleData[i * 4 + 1] = y;
      // previousPosition, start at the same location, which means there is no initial velocity.
      particleData[i * 4 + 2] = x;
      particleData[i * 4 + 3] = y;
      x += step
    }
    return particleData;
  }

  _randomParticles(particleCount, range, max) {
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
    return particleData;
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