export default class Controls {

  constructor(engine) {
    this.engine = engine;
    this.debug = false;
    this.running = engine.running();
  }

  update() {
    
    this.ips.textContent = `speed: ${this.engine._speed}`;
    this.stepCountDiv.textContent = `step: ${this.engine.step}`;
  }

  addControlsToPage() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';

    this.ips = document.createElement('div');
    this.ips.textContent = `speed: 100`;
    this.ips.style.backgroundColor = "white";
    this.ips.style.borderRadius = "2px";
    this.ips.style.textAlign = "center";

    this.stepCountDiv = document.createElement('div');
    this.stepCountDiv.textContent = `step:`;
    this.stepCountDiv.style.backgroundColor = "white";
    this.stepCountDiv.style.borderRadius = "2px";
    this.stepCountDiv.style.textAlign = "center";

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 1;
    slider.max = 100;
    slider.value = 100;

    const eng = this.engine;
    slider.addEventListener("input", function () {
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
    stepButton.textContent = 'Single Step';    
    stepButton.addEventListener("click", () => {
      this.engine.singleStep()
    });

    const stepToContainer = document.createElement('div');

    // New input box and button for setting step number
    const stepInput = document.createElement('input');
    stepInput.type = 'number';
    stepInput.placeholder = 'Enter step number';
    stepInput.style.backgroundColor = "white";
    stepInput.style.borderRadius = "2px";
    stepInput.style.textAlign = "center";

    const setStepButton = document.createElement('button');
    setStepButton.textContent = 'Step to';
    setStepButton.addEventListener("click", () => {
      const stepNumber = parseInt(stepInput.value, 10);
      if (!isNaN(stepNumber)) {
        this.engine.stepTo(stepNumber);
      }
    });
    stepToContainer.appendChild(setStepButton); // Add button to container
    stepToContainer.appendChild(stepInput); // Add input box to container

    container.appendChild(this.stepCountDiv);
    container.appendChild(this.ips);
    container.appendChild(slider);
    container.appendChild(debugButton);
    container.appendChild(startStopButton);
    container.appendChild(stepButton);
    container.appendChild(stepToContainer);

    document.body.appendChild(container);
  }
}