import FPSTracker from "./fps.js";
import setupCanvas from "./canvas.js";
import setupDevice from "./device.js";
import Engine from "./engine/engine.js";
import Controls from "./debug-controls.js";

// This is the size of pixels in the canvas
// the size of the box in which the pixels live
// and the size of the grid for detecting collisions
const SIZE = 256

// const PARTICLE_COUNT = 8_388_608; // max buffer size
// const PARTICLE_COUNT = 1024 * 1023 * 4 -1; // max for compute dispatch groups
const PARTICLE_COUNT = 2

async function main() {

  var fps = new FPSTracker();
  
  const context = setupCanvas(SIZE);
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat(); 
  const device = await setupDevice(context, presentationFormat);
  
  const engine = new Engine(device, presentationFormat, PARTICLE_COUNT, SIZE);
  engine.debug(true);
  const controls = new Controls(engine);
  controls.addControlsToPage();
  
  async function renderLoop(timestamp) {
    fps.update(timestamp);
    controls.update()
    engine.render(context);
    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
}

main();


