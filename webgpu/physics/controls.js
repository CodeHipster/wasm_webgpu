export default class Controls {

  constructor(max_its){
    this.max_its = max_its;
  }
  addControls() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = this.max_its;
    slider.value = this.max_its;

    const debugButton = document.createElement('button');
    debugButton.textContent = 'debug on / off';

    const startStopButton = document.createElement('button');
    startStopButton.textContent = 'Start / stop';

    const stepButton = document.createElement('button');
    stepButton.textContent = 'Step';

    container.appendChild(slider);
    container.appendChild(debugButton);
    container.appendChild(startStopButton);
    container.appendChild(stepButton);

    document.body.appendChild(container);
  }
}