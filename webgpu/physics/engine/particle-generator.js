export default class ParticleGenerator {

  constructor(range){
    this.range = range
    this.half = range/2
  }

  random(count) {
    let particleData = new Int32Array(count * 4);
    for (let i = 0; i < count; i++) {
      var x = Math.random() * this.range - this.half; // x in [min, max]
      var y = Math.random() * this.range - this.half; // y in [min, max]
      // Store as flat data in an array
      // position
      particleData[i * 4] = x;
      particleData[i * 4 + 1] = y;
      // previousPosition, start at the same location, which means there is no initial velocity.
      particleData[i * 4 + 2] = x;
      particleData[i * 4 + 3] = y;
    }
    return particleData
  }
  
}