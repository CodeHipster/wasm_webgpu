export default class ParticleBuffer {
  constructor(device, particleCount, range, min, max, physicsScale) {
    this.physicsScale = physicsScale;
    this.buffer = this._buffer(device, particleCount, range, min, max, physicsScale);
    this.colorBuffer = this._colorBuffer(device, particleCount)
    this.debugBuffer = this._debugBuffer(device, this.buffer)
  }

  debug(on) {
    this._debug = on;
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

    console.log("### logging particles ###")
    await this.debugBuffer.mapAsync(GPUMapMode.READ);
    const debugParticle = new Int32Array(this.debugBuffer.getMappedRange().slice()); //copy data
    this.debugBuffer.unmap(); // give control back to gpu
    for (let i = 0; i < debugParticle.length; i = i + 4) {
      const x = debugParticle[i];
      const y = debugParticle[i+1];
      const px = debugParticle[i+2]; //previous x
      const py = debugParticle[i+3]; //previous y
      console.log(`particle: ${i/4} 
\tgrid      x: ${(x / this.physicsScale).toString().padStart(10,' ')}, \ty:${(y / this.physicsScale).toString().padStart(10,' ')}
\tphysics   x: ${x.toString().padStart(10,' ')}, \ty:${y.toString().padStart(10,' ')}
\tphys step x: ${(x-px).toString().padStart(10,' ')}, \ty:${(y-py).toString().padStart(10,' ')}`);
    }
  }

  _colorBuffer(device, particleCount){
    // Create particle color buffer
    const bufferSize = particleCount * 4 * 4; // 4 floats for each color (float is 4 bytes)
    const particleBuffer = device.createBuffer({
      label: 'particle color buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Initialize particle colors
    let colors = new Float32Array(particleCount * 4);
    colors.fill(1.0); // make all white

    // rgba format
    colors[0] = 1.0; // particle 1 is red
    colors[1] = 0.0; 
    colors[2] = 0.0; 
    colors[3] = 1.0; 
    colors[4] = 0.0; 
    colors[5] = 1.0; // particle 2 is green
    colors[6] = 0.0; 
    colors[7] = 1.0; 
    
    device.queue.writeBuffer(particleBuffer, 0, colors);

    return particleBuffer;
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
    // let particleData = this._randomParticles(particleCount, range, max);
    let particleData = this._particleCollision(particleCount, min, max, physicsScale);
    device.queue.writeBuffer(particleBuffer, 0, particleData);

    return particleBuffer;
  }

  _particleCollision(particleCount, min, max, physicsScale){
    let particleData = new Int32Array(particleCount * 4);
    let x = physicsScale / 2
    let y = max - physicsScale *2;

    // position
    particleData[0 * 4] = x - physicsScale * 4;
    particleData[0 * 4 + 1] = y;
    // previousPosition, moving at x unit per second.
    particleData[0 * 4 + 2] = particleData[0 * 4] - (1 * physicsScale) / 256; 
    particleData[0 * 4 + 3] = y;
    
    // position
    particleData[1 * 4] = x + physicsScale * 4;
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