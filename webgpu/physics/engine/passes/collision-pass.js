const shader = /*wgsl*/`
  const MAX_PARTICLES_PER_CELL: u32 = 30; // 1000 * 1000 * 30 is close to 128mb max storage space. Max size is 1000
  const offsets = array<vec2<i32>, 9>(
    vec2(-1, -1), vec2(0, -1), vec2(1, -1),  // Top neighbors
    vec2(-1, 0), vec2(0, 0), vec2(1, 0),     // Left and Right
    vec2(-1, 1), vec2(0, 1), vec2(1, 1)      // Bottom neighbors
  );

  // Storage Buffers
  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>; 
  @group(0) @binding(1) var<uniform> globals: GlobalVars;
  @group(0) @binding(2) var<storage, read_write> grid: array<u32>; // Stores particle indices
  @group(0) @binding(3) var<storage, read_write> grid_count: array<atomic<u32>>; // Particle count per cell
  @group(0) @binding(4) var<storage, read_write> particle_displacement: array<Displacement>; // Particle displacement
  @group(0) @binding(5) var<storage, read_write> collision_count: atomic<u32>; 

  struct Displacement {
    x: atomic<i32>,
    y: atomic<i32>
  }

  struct Collision {
    hit: bool,
    diff: vec2i,
    dot: i32, // the dot product of vector diff, which is the squared length. x*x + y*y
  }

  struct Neighbours {
    count: u32,
    neighbour: array<u32, 270> //270 = 30*9, max amount of neighbours possible in the cells
  }

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

  // Get byte index of grid[0 -> SIZE] in the array
  // The array is concatenated rows
  // with each cell taking (x + y) * 30 bytes.
  // pos is expected to be a position on the grid [0,SIZE]
  fn arrayIndexOffset(array_index: u32) -> u32 {
    return array_index * MAX_PARTICLES_PER_CELL; //
  }

  fn arrayIndex(grid_pos: vec2i) -> u32 {
    return u32(grid_pos.x + (grid_pos.y * globals.size));
  }

  fn positionOnGrid(pos: vec2i) -> vec2i {
    // To move from signed ints to unsigned ints, 
    let align = globals.size / 2;
    // the width of the grid.
    let x = (pos.x / globals.physics_scale) + align;
    let y = (pos.y / globals.physics_scale) + align;
    return vec2i(x, y);
  }

  // return type is max value that we could have
  // position = the position on the grid. [0,SIZE]
  // TODO: optimize with storage buffer?
  fn getNeighbours(position: vec2i) -> Neighbours {

    var grid_position = positionOnGrid(position);
    var neighbour = array<u32,270>();
    var count: u32 = 0;
    for (var i: u32 = 0; i < 9; i = i + 1) {
      let grid_index = grid_position + offsets[i]; // grid position for the neighbouring cell

      // Ensure the neighbor is within grid bounds
      if (grid_index.x >= 0 && grid_index.x < globals.size && grid_index.y >= 0 && grid_index.y <globals.size) {
        
        let count_index = arrayIndex(grid_index);  // index of count array, which has just 1 u32 for each cell.
        let grid_index = arrayIndexOffset(count_index); // index in the grid array which has index * 30 per cell.
        let n_count = atomicLoad(&grid_count[count_index]); // Loading atomic value here does not cause a problem, as the grid is not modified in this pass.
          
        // fetch count of neighbours
        for (var c: u32 = 0; c < n_count; c = c + 1) {
          let n_index = grid[grid_index + c];
          neighbour[n_count] = n_index;
          count = count + 1;
        }
      }
    }

    // Count will be the nr of neighbours (not the last index)
    return Neighbours(count,neighbour);
  }

  //returns vector between particles and distance_squared if it collides
  fn collides(p1: Particle, p2: Particle) -> Collision {
    let diff = p1.position - p2.position;
    let dot = dot(diff, diff);

    // each particle has a diameter of 1 unit of globals.size. Which is 1 globals.physics_scale.
    // Particle collide if their distance is shorter than 2x the radius. (== diameter)
    // compare squared values to avoid doing sqrt()
    let hit = dot < globals.physics_scale * globals.physics_scale;

    return Collision(hit, diff, dot);
  }

  // returns the amount of displacement for the particle
  // the other particle has the inverse displacement. Since all particles are equally heavy.
  fn bounce(diff: vec2i, dot: i32) -> vec2i {
    // since particles are the same size and have the same mass we do not need to take them into account. 
    // and we can just move both particles in the other direction by some amount to, after many iterations, approach their desired distance.
    return (diff * 3) / 8; // == (diff / 2) * 0.75, moving both particles a part of half the distance they need.
  }

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if(id.x >= arrayLength(&particles)){return;}

      let particle_index = id.x;
      let p = particles[particle_index];
      let neighbours = getNeighbours(p.position);

      for (var i: u32 = 0; i < neighbours.count ; i = i + 1) {
        let n_index = neighbours.neighbour[i]; // get neighbour index
        if(particle_index >= n_index) {continue;} // skip self and avoid doing double collision calculations.
        let n = particles[n_index];
        
        var collision = collides(p, n);
        if(!collision.hit) {continue;}

        atomicAdd(&collision_count,1);

        var displacement = bounce(collision.diff, collision.dot);

        // displace particle
        atomicAdd(&particle_displacement[particle_index].x, displacement.x);
        atomicAdd(&particle_displacement[particle_index].y, displacement.y);
        // displace neighbour
        atomicAdd(&particle_displacement[n_index].x, -displacement.x);
        atomicAdd(&particle_displacement[n_index].y, -displacement.y);
      }
  }
`

export default class CollisionPass {

  constructor(device, globalsBuffer, particleBuffer, gridBuffer, gridCountBuffer, particleCount, workgroupCount) {
    this.pipeline = this._pipeline(device);
    this.displacementBuffer = this._displacementBuffer(device, particleCount);
    this.displacementDebugBuffer = this._displacementDebugBuffer(device, this.displacementBuffer)
    this.collisionCountBuffer = this._collisionCountBuffer(device);
    this.collisionCountDebugBuffer = this._collisionCountDebugBuffer(device)
    
    this.bindGroup = this._bindGroup(device, globalsBuffer, particleBuffer, gridBuffer, gridCountBuffer, this.displacementBuffer, this.collisionCountBuffer, this.pipeline);
    this.workgroupCount = workgroupCount;
  }

  debug(on, physicsScale) {
    this.physicsScale = physicsScale;
    this._debug = on;
  }

  async debugLog() {
    if (!this._debug) {
      console.log("debug not enabled on CollisionPass")
      return;
    }

    console.log("logging displacements")
    await this.displacementDebugBuffer.mapAsync(GPUMapMode.READ);
    const debugDisplacement = new Int32Array(this.displacementDebugBuffer.getMappedRange().slice()); //copy data
    this.displacementDebugBuffer.unmap(); // give control back to gpu
    console.log(debugDisplacement);
    for (let i = 0; i < debugDisplacement.length; i = i + 2) {
      console.log(`index: ${i / 2} x: ${debugDisplacement[i] / this.physicsScale}, y: ${debugDisplacement[i + 1] / this.physicsScale}`)
    }

    await this.collisionCountDebugBuffer.mapAsync(GPUMapMode.READ);
    const collisionCount = new Uint32Array(this.collisionCountDebugBuffer.getMappedRange().slice()); //copy data
    this.collisionCountDebugBuffer.unmap(); // give control back to gpu
    console.log(collisionCount);

  }

  pass(commandEncoder) {
    // wipe buffers to remove data from previous pass
    commandEncoder.clearBuffer(this.displacementBuffer);

    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.workgroupCount);
    pass.end();

    if (this._debug) {
      // Encode a command to copy the results to a mappable buffer.
      commandEncoder.copyBufferToBuffer(this.displacementBuffer, 0, this.displacementDebugBuffer, 0, this.displacementDebugBuffer.size);
      commandEncoder.copyBufferToBuffer(this.collisionCountBuffer, 0, this.collisionCountDebugBuffer, 0, this.collisionCountDebugBuffer.size);
    }
  }

  _pipeline(device) {
    const module = device.createShaderModule({
      label: 'collision-pass.js',
      code: shader,
    });

    return device.createComputePipeline({
      layout: "auto",
      compute: { module: module, entryPoint: "main" }
    });
  }

  _bindGroup(device, globalsBuffer, particleBuffer, gridBuffer, gridCountBuffer, displacementBuffer, collisionCountBuffer, pipeline) {
    return device.createBindGroup({
      label: 'collision-bindgroup',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: globalsBuffer } },
        { binding: 2, resource: { buffer: gridBuffer } },
        { binding: 3, resource: { buffer: gridCountBuffer } },
        { binding: 4, resource: { buffer: displacementBuffer } },
        { binding: 5, resource: { buffer: collisionCountBuffer } },
      ]
    });
  }

  _displacementBuffer(device, particleCount) {
    return device.createBuffer({
      label: 'displacement buffer',
      size: 4 * 2 * particleCount, // x,y per particle
      // COPY_DST required for clearing buffer
      // COPY_SRC for copy to debug buffer
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
  }
  
  _displacementDebugBuffer(device, buffer) {
    // create a buffer on the GPU to get a copy of the results
    return device.createBuffer({
      label: 'displacement debug buffer',
      size: buffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }
  
  _collisionCountBuffer(device) {
    // create a buffer on the GPU to get a copy of the results
    return device.createBuffer({
      label: 'collision count buffer',
      size: 8, // 1 u32 of 4 bytes. and empty space because the minimum is 8
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
  }
  
  _collisionCountDebugBuffer(device) {
    // create a buffer on the GPU to get a copy of the results
    return device.createBuffer({
      label: 'collision count debug buffer',
      size: 8, // 1 u32 of 4 bytes. and empty space because the minimum is 8
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }
}