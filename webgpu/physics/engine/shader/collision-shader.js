export default `
// memory: atomic particle displacement

// main method: for each particle
// or for each grid?

// find the cell the particle is in
// get all surrounding particles
// check with each particle the intersection
// if intersecting, calculate resulting displacement for both
// and add displacement to values in array

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