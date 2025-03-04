export default class GridSortPass {

  constructor(device, globalsBuffer, particleBuffer, gridBuffer, gridCountBuffer, workgroupCount) {
    this.pipeline = this._pipeline(device);
    this.bindGroup = this._bindGroup(device, globalsBuffer, particleBuffer, gridBuffer, gridCountBuffer, this.pipeline);
    this.workgroupCount = workgroupCount;
  }

  pass(commandEncoder) {
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.workgroupCount);
    pass.end();
  }

  _pipeline(device) {
    const gravityModule = device.createShaderModule({
      label: 'grid-sort.js',
      code: gridSortWGSL,
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
}

const gridSortWGSL = /*wgsl*/`
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