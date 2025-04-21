# TODO

## bugs
size < 20 makes the particles fall up?

## Goal
verlet integration between particles and the bounding box

## Steps

### 1000 x 1000 pixels - DONE
The canvas will be 1000x1000 pixels.
The box in which the particles live will be 1000x1000
This means we will have to do a translation in the vertex shader to map it to -1, 1

### integer values for pixel positions - DONE
since we have a max value of 1000 and a min of 0. we can scale the positions to be integer values
This will give us the benefit to do atomic adds on position if multiple particles exert force at the same time.

u32 max: 4_294_967_295, so we can have the position between 100_000 & 4.1mil. (leaving a bit of space for particles to move outside of the clamp area?)

so scale is: 4_000_000 / SIZE. e.g. 4_000
position is: (pos - 100_000) / scale. e.g. (1_700_000 - 100_000) / 4_000 = 400
scaled position is: (pos * scale) + 100_000

### sort pixels into grid - DONE

grid = 1000x1000
each cell has space for 30 pixels
the cells will contain id's to the particle in the particles array
A separate storage will keep track of the nr of particles in a cell in an atomic way.

Storage requirements for the grid are 1_000_000 * 30 * 4 = 120_000_000 bytes. The max storage = 128Mib = 134_217_728 bytes
So this should fit as an upper limit. We will have to check what the performance says about this in regards of memory misses.

### collision detection - DONE

check for collision with the 9 cells around. using the previously constructed grid.

Keep a separate atomic storage for x,y displacements for particles. 
When calculating displacement add to storage

on the next pass, apply displacement to each particle.

take extra care with integer overflow. When using squared distance, the values can easily overflow.
The maximum distance 2 particles can be is when they are diagonally in opposite cells.
e.g. cell 0 & 8 or 6 & 2. the squared distance will be 3 * 3 + 3 * 3 = 18

[0][1][2]
[3][4][5]
[6][7][8]

The units will be multiplied by the physics scale. And the physicsScale in turn is dependant on the size of the grid.
for a grid size of 1000, the physics scale = 4_000_768
((12_002_304 * 12_002_304) + (12_002_304 * 12_002_304)) = 2.881106e+14
Which is too big to fit into a i32, which is 2_147_483_647 (2.1e+9)

So we will have to loose some precision and scale down the values when comparing distances.
This can be done efficiently using bitwise shifts. Every shift divides by 2.

Shifting 9 times (/512) gives us:
((23442 * 23442) + (23442 * 23437)) = 1_098_937_518 (8 shifts would still overflow.)

Extra: Take velocity into account when particles collide. So that when we have a collision where the centers have already passed eachother, there is no slingshot, but a correct bounce.
  - use cross product of velocity and diff? if positive or negative should tell us on which side it is. add a whole diameter to diff to compensate.

#### debugging collision detection - DONE
- DONE - add color to particles
- render on a different scale, maybe use a different renderer https://webgpufundamentals.org/webgpu/lessons/webgpu-points.html
- render circles
- DONE make engine manually steppable
- DONE log velocity
- DONE log physics scale values
- DONE be able to run until specific frame

### have the boundry pushback before clipping - DONE

### have correct physics even if particle moves beyond the halfway point. - DONE

### add colors to pixels based on velocity - DONE

### deploy online - DONE

### build it completely in floats
- change buffers to floats, except particle displacement which is used in collision detection.
  - will have to determine how to scale to loose the least precision. 
- change calculations to floats
- do collision detection with a grid of 3x3 and do 9 collision passes.
  - investigate potential overhead of having 9 passes compared to 1.



### use observable controls for the engine
So it is easy for the control visuals to update when state changes in the engine.

### make engine controllable
- size
- pixels
- stiffness
- ips
- fps
- pixel faucet on click/touch

### add mobile accelerometer input for gravity

### detect refreshrate of browser instead of assuming 60
Sadly we can't get the refreshrate from the browser. So we will have to run a second refresh cycle to get the value.
Maybe round off to nearest standard. 60/90/120/144 etc

### log performance of the gpu
Not sure how we can do this, but we should be able to detect if the gpu command queue is filling up, or if it is coping


### build it completely in ints

### profile gpu




