export default class Controls {

  constructor(engine) {
    this.engine = engine;
    this.debug = false;
    this.running = true;
  }

  stepCount(step) {
    this.stepCountDiv.textContent = `step: ${step}`;
  }

  addControlsToPage() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';

    const ips = document.createElement('div');
    ips.textContent = `speed: 100`;
    ips.style.backgroundColor = "white";
    ips.style.borderRadius = "2px";
    ips.style.textAlign = "center";

    this.stepCountDiv = document.createElement('div');
    this.stepCountDiv.textContent = `step: 0`;
    this.stepCountDiv.style.backgroundColor = "white";
    this.stepCountDiv.style.borderRadius = "2px";
    this.stepCountDiv.style.textAlign = "center";

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 1;
    slider.max = 100;
    slider.value = 100;

    const eng = this.engine;
    console.log(eng)
    slider.addEventListener("input", function () {
      ips.textContent = `speed: ${this.value}`;
      eng.speed(this.value);
    });

    const debugButton = document.createElement('button');
    debugButton.textContent = `debug: ${this.debug}`;
    debugButton.addEventListener("click", () => {
      this.debug = !this.debug;
      debugButton.textContent = `debug: ${this.debug}`;
      this.engine.debug(this.debug)
    });

    const startStopButton = document.createElement('button');
    startStopButton.textContent = `running: ${this.running}`;
    startStopButton.addEventListener("click", () => {
      this.running = !this.running;
      startStopButton.textContent = `running: ${this.running}`;
      if(this.running){
        this.engine.start()
      }else{
        this.engine.stop()
      }
    });

    const stepButton = document.createElement('button');
    stepButton.textContent = 'Step';    
    stepButton.addEventListener("click", () => {
      this.engine.singleStep()
    });

    container.appendChild(this.stepCountDiv);
    container.appendChild(ips);
    container.appendChild(slider);
    container.appendChild(debugButton);
    container.appendChild(startStopButton);
    container.appendChild(stepButton);

    document.body.appendChild(container);
  }
}