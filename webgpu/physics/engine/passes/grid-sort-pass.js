const shader = /*wgsl*/`
  const MAX_PARTICLES_PER_CELL: u32 = 30; // 1000 * 1000 * 30 is close to 128mb max storage space. Max size is 1000

  struct GlobalVars {
    gravity: vec2i, // (x,y) acceleration
    min: i32,
    max: i32,
    physics_scale: i32, // for scaling down to grid size
    rander_scale: i32, // for scaling down to clip_space
    sps_2: i32, // steps per second squared
    size: i32, // size of the simulation, x=y (it is a square)
  };

  struct Particle {
    position: vec2<i32>,
    prev_position: vec2<i32>,
  };

  // Storage Buffers
  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>; 
  @group(0) @binding(1) var<uniform> globals: GlobalVars;
  @group(0) @binding(2) var<storage, read_write> grid: array<u32>; // Stores particle indices
  @group(0) @binding(3) var<storage, read_write> grid_count: array<atomic<u32>>; // Particle count per cell

  // Hash function: Maps a position to a grid index
  fn gridIndex(pos: vec2<i32>) -> u32 {
    // To move from signed ints to unsigned ints, 
    let align = globals.size / 2;
    // the width of the grid.

    let x = (pos.x / globals.physics_scale) + align;
    let y = (pos.y / globals.physics_scale) + align;

    return u32(y * globals.size + x);
  }

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if(id.x >= arrayLength(&particles)){return;}

      let particle_index = id.x;

      let particle_pos = particles[particle_index].position;
      let grid_index = gridIndex(particle_pos);

      // Use atomicAdd to ensure safe writing
      let slot = atomicAdd(&grid_count[grid_index], 1);
      if (slot < MAX_PARTICLES_PER_CELL) {
        // This will make it a sparse array.
          grid[grid_index * MAX_PARTICLES_PER_CELL + slot] = particle_index;
      }
  }
`
export default class GridSortPass {

  constructor(device, globalsBuffer, particleBuffer, workgroupCount, size, particlesPerCell) {
    this.size = size;
    this.gridBuffer = this._gridBuffer(device, size, particlesPerCell)
    this.gridDebugBuffer = this._gridDebugBuffer(device, this.gridBuffer)
    this.gridCountBuffer = this._gridCountBuffer(device, size)
    this.gridCountDebugBuffer = this._gridCountDebugBuffer(device, this.gridCountBuffer)

    this.pipeline = this._pipeline(device);
    this.bindGroup = this._bindGroup(device, globalsBuffer, particleBuffer, this.gridBuffer, this.gridCountBuffer, this.pipeline);
    this.workgroupCount = workgroupCount;
  }

  debug(on) {
    this._debug = on;
  }

  async debugLog() {
    if (!this._debug) {
      console.log("Debug is disabled on GridSortPass.");
      return
    }

    await this.gridDebugBuffer.mapAsync(GPUMapMode.READ);
    const debugGrid = new Uint32Array(this.gridDebugBuffer.getMappedRange().slice()); //copy data to cpu memory
    this.gridDebugBuffer.unmap(); // give control back to gpu

    await this.gridCountDebugBuffer.mapAsync(GPUMapMode.READ);
    const debugGridCount = new Uint32Array(this.gridCountDebugBuffer.getMappedRange().slice()); //copy data to cpu memory
    this.gridCountDebugBuffer.unmap(); // give control back to gpu

    console.log("### logging grid ###")
    for (const [index, count] of debugGridCount.entries()) {
      if (count == 0) continue;
      const x = index % this.size;
      const y = Math.floor(index / this.size);
      console.log(`x: ${x}, y: ${y}, count:${count}`);
      for (let i = 0; i < count; i++) {
        const p_index = debugGrid[index * 30 + i]
        console.log(`\tparticle: ${p_index} `);
      }
    }
  }

  pass(commandEncoder) {
    // wipe buffers to remove data from previous pass
    commandEncoder.clearBuffer(this.gridBuffer);
    commandEncoder.clearBuffer(this.gridCountBuffer);

    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.workgroupCount);
    pass.end();

    if (this._debug) {
      commandEncoder.copyBufferToBuffer(this.gridBuffer, 0, this.gridDebugBuffer, 0, this.gridDebugBuffer.size);
      commandEncoder.copyBufferToBuffer(this.gridCountBuffer, 0, this.gridCountDebugBuffer, 0, this.gridCountDebugBuffer.size);
    }
  }

  _pipeline(device) {
    const gravityModule = device.createShaderModule({
      label: 'grid-sort-pass.js',
      code: shader,
    });

    return device.createComputePipeline({
      layout: "auto",
      compute: { module: gravityModule, entryPoint: "main" }
    });
  }

  _bindGroup(device, globalsBuffer, particleBuffer, grid, gridCount, pipeline) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: globalsBuffer } },
        { binding: 2, resource: { buffer: grid } },
        { binding: 3, resource: { buffer: gridCount } },
      ]
    });
  }

  // TODO: particles per cell in global var.
  // stores indexes to particles per cell
  _gridBuffer(device, size, particlesPerCell) {
    return device.createBuffer({
      label: 'grid buffer',
      size: 4 * size * size * particlesPerCell,
      // COPY_DST required for clearing buffer
      // COPY_SRC for copy to debug buffer
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
  }

  _gridDebugBuffer(device, buffer) {
    // create a buffer on the GPU to get a copy of the results
    return device.createBuffer({
      label: 'grid debug buffer',
      size: buffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }

  // stores the nr of particles in a given cell as u32
  _gridCountBuffer(device, size) {
    return device.createBuffer({
      label: 'gridCount buffer',
      size: 4 * size * size,
      // COPY_DST required for clearing buffer
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
  }

  // stores the nr of particles in a given cell as u32
  _gridCountDebugBuffer(device, buffer) {
    // create a buffer on the GPU to get a copy of the results
    return device.createBuffer({
      label: 'grid count debug buffer',
      size: buffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }
}

