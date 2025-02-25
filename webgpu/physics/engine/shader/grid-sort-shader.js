export default /*wgsl*/`
let GRID_SIZE: f32 = 10.0;
let GRID_CAPACITY: u32 = 4096;
let MAX_PARTICLES_PER_CELL: u32 = 4; // Adjust as needed

// Storage Buffers
@group(0) @binding(0) var<storage, read_write> particles: array<vec2<f32>>; 
@group(0) @binding(1) var<storage, read_write> grid: array<u32>; // Stores particle indices
@group(0) @binding(2) var<storage, read_write> gridCount: array<u32>; // Particle count per cell

// Hash function: Maps a position to a grid index
fn hashGridIndex(pos: vec2<f32>) -> u32 {
    let x: i32 = i32(floor(pos.x / GRID_SIZE));
    let y: i32 = i32(floor(pos.y / GRID_SIZE));
    return u32((x * 73856093) ^ (y * 19349663)) % GRID_CAPACITY;
}

@compute @workgroup_size(64)
fn populateGrid(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= arrayLength(&particles)) { return; }

    let particlePos = particles[index];
    let hashIndex = hashGridIndex(particlePos);

    // Use atomicAdd to ensure safe writing
    let slot = atomicAdd(&gridCount[hashIndex], 1);
    if (slot < MAX_PARTICLES_PER_CELL) {
        grid[hashIndex * MAX_PARTICLES_PER_CELL + slot] = index;
    }
}
`