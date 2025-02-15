async function main() {
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

  // Shader has both a vertex shader and fragment shader
  const module = device.createShaderModule({
    label: 'our hardcoded red triangle shaders', // Label is used in error messages.
    code: /* wgsl */`
    // @vertex attribute means that this is a vertex shader.
    // @builtin attribute means that we are using a builtin variable named vertex_index
    // vertex index is the index of the call to vertex. In this case 3, because of the pass.draw(3) in the commands
    // @builtin position means the result will be assigned to the build in position.
    // the return type is a 4f vector x,y,z,w that contains the position of the vertex to be used in the fragment shader. (x,y,z are divided by w, for 3d scaling)
      @vertex fn vs( @builtin(vertex_index) vertexIndex : u32 ) -> @builtin(position) vec4f {
        // positions in the gpu (clipspace) go from -1 to 1, regardless of the aspect ratio.
          let pos = array(
            vec2f( 0.0,  0.5),  // top center
            vec2f(-0.5, -0.5),  // bottom left
            vec2f( 0.5, -0.5)   // bottom right
          );

          // put z as 0 and w as 1
          return vec4f(pos[vertexIndex], 0.0, 1.0);
        }

        // @fragment tells us this is a fragment shader
        // the return type is @location attribute, which tells us where to write the pixels to. Which is the texture we provide in the renderPassDescriptor.colorAttachements[0].view
      @fragment fn fs() -> @location(0) vec4f {
        // this 4f vector is the colors rbg and alpha between 0 and 1
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
  });

  // pipeline defines the shaders to use.
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto', // data layout, though this example has no data
    vertex: {
      entryPoint: 'vs', // method name in shader code
      module, // the code where to find the function
    },
    fragment: {
      entryPoint: 'fs',// method name in shader code
      module,
      targets: [{ format: presentationFormat }],
    },
  });

  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        clearValue: [0.3, 0.3, 0.3, 1], // value for the texture to be cleared to
        loadOp: 'clear', // before drawing clear the texture
        storeOp: 'store', // store the result of what is drawn on the texture
      },
    ],
  };  

  function render() {
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();
 
    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'our encoder' });
 
    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.draw(3);  // call our vertex shader 3 times
    pass.end();
 
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
 
  render();
}

main();