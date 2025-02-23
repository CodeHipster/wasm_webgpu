export default class FPSTracker {
  constructor() {
    this.fps = 0;              // Current FPS value
    this.lastFrameTime = 0;    // Timestamp of the last frame
    this.frameCount = 0;       // Number of frames counted in a second
    this.lastFpsUpdate = 0;    // Timestamp of the last FPS update
  }

  update(timestamp) {
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;

    // Time difference between frames
    const deltaTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    this.frameCount++;

    // Update FPS every second
    if (timestamp - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
      console.log(this.fps)
    }
  }

  getFPS() {
    return this.fps;
  }
}