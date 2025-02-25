export default function setupCanvas(size){
  // Create a canvas element
  const canvas = document.createElement("canvas");

  // Set width and height
  canvas.width = size;
  canvas.height = size;

  // Style canvas
  canvas.style.width = "100vmin";
  canvas.style.height = "100vmin";
  canvas.style.imageRendering = "pixelated"; // Ensures sharpness

  // Append the canvas to the body or a specific container
  document.body.appendChild(canvas);
  return canvas.getContext('webgpu');
}