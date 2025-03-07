const shader = /*wgsl*/`
  const MAX_PARTICLES_PER_CELL: u32 = 30; // 1000 * 1000 * 30 is close to 128mb max storage space. Max size is 1000
  const OUT_OF_BOUNDS: u32 = 4294967295;
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
  @group(0) @binding(4) var<storage, read_write> particle_displacement: array<atomic<i32>>; // Particle displacement 2 ints for each particle. x & y

  struct Collision {
    hit: bool,
    diff: vec2i,
    mag_sq: i32,
  }

  struct Neighbours {
    count: u32,
    neighbour: array<u32, 270>
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

  fn arrayIndex(grid_pos: vec2<i32>) -> u32 {
    return u32(grid_pos.x + (grid_pos.y * globals.size));
  }

  fn positionOnGrid(pos: vec2<i32>) -> vec2<i32> {
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

    var neighbour = array<u32,270>();
    var count = 0;
    for (var i: u32 = 0; i < 9; i = i + 1) {
      let grid_index = position + offsets[i];

      // Ensure the neighbor is within grid bounds
      if (grid_index.x >= 0 && grid_index.x < globals.size && grid_index.y >= 0 && grid_index.y <globals.size) {
        let count_index = arrayIndex(grid_index);  // index of count array, which has just 1 u32 for each cell.
        let grid_index = arrayIndexOffset(count_index); // index in the grid array which has index * 30 per cell.
        let n_count = grid_count[count_index];
          
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

  fn distanceSquared(v : vec2i) -> i32 {
    // TODO implement, for now returning something that always misses
    return globals.physics_scale * 2;
  }

  //returns vector between particles and distance_squared if it collides
  fn collides(p1: Particle, p2: Particle) -> Collision {
    // TODO: implement, for now not colliding
    return Collision(false, vec2i(0, 0), 0);
  }

  // returns the amount of displacement for the particle
  // TODO: potential optimization as we also know the displacement of the other particle.
  // if other particle index < this particle index, we have already calculated for both.
  fn bounce(diff: vec2i, magnitude_squared: i32) -> vec2i {
    return vec2i(1,1);
  }

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if(id.x >= arrayLength(&particles)){return;}

      let particle_index = id.x;
      let p = particles[particle_index];
      let neighbours = getNeighbours(p.position);

      for (var i: u32 = 0; i < neighbours.count ; i = i + 1) {
        let n_index = neighbours.neighbour[i]; // get neighbour index
        let n = particles[n_index];
        
        var collision = collides(p, n);
        if(!collision.hit) {continue;}

        var displacement = bounce(collision.diff, collision.mag_sq);

        // set displacement values in buffer
        // Use atomicAdd to ensure safe writing
        let displacement_index = particle_index * 2;
        atomicAdd(&particle_displacement[displacement_index], displacement.x);
        atomicAdd(&particle_displacement[displacement_index + 1], displacement.y);
      }
  }

  // radius == physicsScale

  //const dot1Pos = this.reuseVec1.setXY(x, y)
    //   const dot2Pos = this.reuseVec2.setXY(x2, y2)
    //   const dot1Radius = this.radius
    //   const dot2Radius = this.radius
    //   const vec = dot1Pos.subVec(dot2Pos)
    //   const disSq = vec.magSq()
    //   const disMin = dot1Radius + dot2Radius
    //   const disMinSq = disMin * disMin
    //   if (disSq < disMinSq) {
    //     // we are colliding
    //     const dist = Math.sqrt(disSq)
    //     const normal = vec.divNr(dist)
    //     const dot1Mass = this.mass
    //     const dot2Mass = this.mass
    //     const totalMass = dot1Mass + dot2Mass
    //     const dot1MassEffect = dot1Mass / totalMass
    //     const dot2MassEffect = dot2Mass / totalMass
    //     const coeff = 0.75
    //     const delta = 0.5 * coeff * (dist - disMin)
    //     // Update positions
    //     this.reuseVec2.setVec(normal)
    //     const dot1Translation = normal.mul(-dot2MassEffect * delta)
    //     const dot2Translation = this.reuseVec2.mul(dot1MassEffect * delta)
    //     this.reuseResult.x1 = dot1Translation.x
    //     this.reuseResult.y1 = dot1Translation.y
    //     this.reuseResult.x2 = dot2Translation.x
    //     this.reuseResult.y2 = dot2Translation.y

    //     return this.reuseResult
    //   }
    // }


`

export default class CollisionPass {

  constructor(device, globalsBuffer, particleBuffer, gridBuffer, gridCountBuffer, particleCount, workgroupCount) {
    this.pipeline = this._pipeline(device);
    this.displacementBuffer = this._displacementBuffer(device, particleCount);
    this.displacementDebugBuffer = this._displacementDebugBuffer(device, this.displacementBuffer)
    this.bindGroup = this._bindGroup(device, globalsBuffer, particleBuffer, gridBuffer, gridCountBuffer, this.displacementBuffer, this.pipeline);
    this.workgroupCount = workgroupCount;
  }

  debug(physicsScale) {
    this.physicsScale = physicsScale;
    this._debug = true;
  }

  async logDebug() {
    if (!this._debug) {
      console.log("debug not enabled on CollisionPass")
      return;
    }

    console.log("logging displacements")
    await this.displacementDebugBuffer.mapAsync(GPUMapMode.READ);
    const debugDisplacement = new Int32Array(this.displacementDebugBuffer.getMappedRange().slice()); //copy data
    this.displacementDebugBuffer.unmap(); // give control back to gpu
    for (let i = 0; i < debugDisplacement.length; i = i + 2) {
      console.log("x: " + debugDisplacement[i] / this.physicsScale, "y: " + debugDisplacement[i + 1] / this.physicsScale)
    }
  }

  pass(commandEncoder) {
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.workgroupCount);
    pass.end();

    if (this._debug) {
      // Encode a command to copy the results to a mappable buffer.
      commandEncoder.copyBufferToBuffer(this.displacementBuffer, 0, this.displacementDebugBuffer, 0, this.displacementDebugBuffer.size);
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

  _bindGroup(device, globalsBuffer, particleBuffer, gridBuffer, gridCountBuffer, displacementBuffer, pipeline) {
    return device.createBindGroup({
      label: 'collision-bindgroup',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: globalsBuffer } },
        { binding: 2, resource: { buffer: gridBuffer } },
        { binding: 3, resource: { buffer: gridCountBuffer } },
        { binding: 4, resource: { buffer: displacementBuffer } },
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
}