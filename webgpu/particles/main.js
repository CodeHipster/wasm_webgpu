import particleCompute from "./particle-compute.js";
import particleShader from "./particle-shader.js";
import FPSTracker from "./fps.js";

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
  const CANVAS_SIZE = 1000;
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  // const particleCount = 8_388_608; // max buffer size
  const particleCount = 1024 * 1024 * 4 -1; // max for 1 compute dispatch group
  // const particleCount = 1000
  const bufferSize = particleCount * 2 * 4 * 2; // 2 floats for x,y, for pos and previous pos

  // Create particle buffer (shared between compute & render)
  const particleBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });

  // Initialize particle positions
  let particleData = new Float32Array(particleCount * 2);
  for (let i = 0; i < particleCount; i++) {
    var x = Math.random() * 2 - 1 // x in [-1,1]
    var y = Math.random() * 2 - 1 // y in [-1,1]
    // position
    particleData[i * 4] = x;
    particleData[i * 4 + 1] = y;
    // previousPosition, start at the same location, which means there is no initial velocity.
    particleData[i * 4 + 2] = x;
    particleData[i * 4 + 3] = y;
  }
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
    entries: [{ binding: 0, resource: { buffer: particleBuffer } }]
  });

  // Render pipeline
  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: renderModule,
      entryPoint: "vs_main",
      buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }]
    },
    fragment: {
      module: renderModule,
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }]
    },
    primitive: { topology: "point-list" }
  });

  const renderBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: particleBuffer } }]
  });


  function renderLoop(timestamp) {
    fps.update(timestamp)
    const commandEncoder = device.createCommandEncoder();

    // Compute Pass (Physics Update)
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(computePipeline);
      pass.setBindGroup(0, computeBindGroup);
      pass.dispatchWorkgroups(particleCount / 64);
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
      pass.draw(particleCount);
      pass.end();
    }

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
}


main();


