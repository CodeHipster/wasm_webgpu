// Setup GPU
export default async function setupDevice(context, presentationFormat){
  
  // Get the GPU device.
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    throw new Error('need a browser that supports WebGPU');
  }

  // Link canvas with the device.
  context.configure({
    device,
    format: presentationFormat, // This increases performance for the device if formats are aligned.
  });

  return device
}