# TODO

## GoaL
verlet integration between particles and the bounding box

## Steps

### 1000 x 1000 pixels - DONE
The canvas will be 1000x1000 pixels.
The box in which the particles live will be 1000x1000
This means we will have to do a translation in the vertex shader to map it to -1, 1

### integer values for pixel positions
since we have a max value of 1000 and a min of 1000. we can scale the positions to be integer values
This will give us the benefit to do atomic adds on position if multiple particles exert force at the same time.

u32 max: 4_294_967_295, so we can have the position between 100_000 & 4.1mil. (leaving a bit of space for particles to move outside of the clamp area?)

### sort pixels into grid

grid = 1000x1000
each cell has space for 30 pixels
the cells will contain id's to the particle in the particles array
A separate storage will keep track of the nr of particles in a cell in an atomic way.

Storage requirements for the grid are 1_000_000 * 30 * 4 = 120_000_000 bytes. The max storage = 128Mib = 134_217_728 bytes
So this should fit as an upper limit. We will have to check what the performance says about this in regards of memory misses.

### collision detection

check for collision with the 9 cells around. using the previously constructed grid.

### add physics 
do calculations to determine new position based from forces of other particles & gravity




