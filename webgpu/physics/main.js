import particleCompute from "./particle-compute.js";
import particleShader from "./particle-shader.js";
import FPSTracker from "./fps.js";

// This is the size of pixels in the canvas
// the size of the box in which the pixels live
// and the size of the grid for detecting collisions
const SIZE = 100

// const PARTICLE_COUNT = 8_388_608; // max buffer size
// const PARTICLE_COUNT = 1024 * 1024 * 4 -1; // max for compute dispatch groups
const PARTICLE_COUNT = 1

async function main() {

  var fps = new FPSTracker()

  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat(); // This increases performance for the device if formats are aligned.
  context.configure({
    device,
    format: presentationFormat,
  });

  // Set internal resolution
  canvas.width = SIZE;
  canvas.height = SIZE;

  // scaling to be able to use only i32 instead of floats.
  // This will give a 286_000_000 buffer before they over/underflow
  // const range = 4_000_000_000, close to max u32
  const range = Math.pow(2, 23) // within the float precision scale
  const physicsScale = range / SIZE // the size of a pixel
  const renderScale = range / 2 // to scale position back into clip space (-1,1)
  const min = range / -2
  const max = range / 2

  // Create uniform with global variables
  const globalsBufferSize =
    2 * 4 + // gravity is 2 i32 (4bytes each)
    2 * 4 + // min, max are i32
    2 * 4 // scales are i32
    ;
  const globalsBuffer = device.createBuffer({
    size: globalsBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // create a typedarray to hold the values for the uniforms in JavaScript
  const globals = new Int32Array(globalsBufferSize / 4);

  // set the values in the correct place for the uniform struct in wgsl.
  globals.set([0, -10 * physicsScale], 0) // gravity
  globals.set([min, max], 2) // min and max position bounds
  globals.set([physicsScale, renderScale], 4) // scale
  console.log(globals)

  // queue writing globals to the buffer
  device.queue.writeBuffer(globalsBuffer, 0, globals);

  // Create particle buffer (shared between compute & render)
  const bufferSize = PARTICLE_COUNT * 4 * 2 * 2; // 4 ints for x,y, current pos and previous pos
  const particleBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });

  // Initialize particle positions
  let particleData = new Float32Array(PARTICLE_COUNT * 4);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    var x = Math.random() * range - max; // x in [min, max]
    var y = Math.random() * range - max; // y in [min, max]
    // Store as flat data in an array
    // position
    particleData[i * 4] = x;
    particleData[i * 4 + 1] = y;
    // previousPosition, start at the same location, which means there is no initial velocity.
    particleData[i * 4 + 2] = x;
    particleData[i * 4 + 3] = y;
  }
  console.log("x: "+particleData[0]/ physicsScale, "y: " + particleData[1]/ physicsScale)
  device.queue.writeBuffer(particleBuffer, 0, particleData);

  const computeModule = device.createShaderModule({
    label: 'particle-compute.js',
    code: particleCompute,
  });

  const renderModule = device.createShaderModule({
    label: 'particle-shader.js',
    code: particleShader,
  });

  // Compute pipeline
  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module: computeModule, entryPoint: "main" }
  });

  const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: globalsBuffer } }]
  });

  // Render pipeline
  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: renderModule,
      entryPoint: "vs_main",
      //arrayStride=bytes to skip per step , attributes: [{ shaderLocation=nr of buffer to use, offset=start pos in the buffer, format=format of the data in the buffer }]
      // buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }] // Do we actually need this? We could use it to directly get the particles as an argument to the vertex shader.
    },
    fragment: {
      module: renderModule,
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }]
    },
    primitive: { topology: "point-list" } // Telling webgpu that our vertexes are points and don't need triangle interpolation for the fragment shader
  });

  const renderBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: globalsBuffer } }]
  });

  function renderLoop(timestamp) {
    fps.update(timestamp)
    const commandEncoder = device.createCommandEncoder();

    // Compute Pass (Physics Update)
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(computePipeline);
      pass.setBindGroup(0, computeBindGroup);
      pass.dispatchWorkgroups(PARTICLE_COUNT / 64 + 1);
      pass.end();
    }

    // Render Pass (Draw Particles)
    {
      const textureView = context.getCurrentTexture().createView();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: [0, 0, 0, 1] // Black background
        }]
      });

      pass.setPipeline(renderPipeline);
      pass.setBindGroup(0, renderBindGroup);
      pass.setVertexBuffer(0, particleBuffer);
      pass.draw(PARTICLE_COUNT);
      pass.end();
    }

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
}


main();


