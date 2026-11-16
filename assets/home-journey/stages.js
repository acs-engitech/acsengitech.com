// Positions, bounds and anchors remain stable when approved GLBs replace the procedural actors.
export const modelSlots = {
  factory: { modelUrl: null, size: [36, 7.5, 22], position: [0, 0, 0], reference: null, status: 'Illustrative covered stockyard shed with walkways and an operator desk. Not a replica of a specific client plant or of the ACS facility.' },
  line: { modelUrl: null, size: [16, 6.5, 12], position: [0, 0, 0], reference: null, status: 'Illustrative stacker and reclaimer stockyard: coal and ore stockpiles, rail-mounted boom stacker and bucket-wheel reclaimer, yard conveyor and junction house.' },
  panel: { modelUrl: null, size: [1.6, 2.15, .62], position: [5.6, 0, 1], reference: 'assets/acs/control-panels.webp', status: 'Representative ACS PLC control panel. Component layout is illustrative; every project is engineered to its own specification.' },
  mcc: { modelUrl: null, size: [7.4, 2.4, .65], position: [2.6, 0, -5.2], reference: 'assets/acs/mcc-panel.jpg', status: 'Representative compartmental MCC based on ACS MCC panel photography.' }
};

// Door-open callouts for the PLC panel. Anchors are in panel-local metres; side decides which edge the label sits on.
export const callouts = [
  { id: 'supply', label: 'Isolator & 24 V DC supplies', note: 'Main switch and clean control power', anchor: [-.24, 1.81, -.14], side: 'left' },
  { id: 'mcb', label: 'MCB distribution', note: 'Protection for every circuit', anchor: [.3, 1.82, -.17], side: 'right' },
  { id: 'plc', label: 'PLC CPU & I/O modules', note: 'Siemens PLC, programmed in TIA Portal', anchor: [-.45, 1.39, -.15], side: 'left' },
  { id: 'switch', label: 'Industrial Ethernet switch', note: 'PLC, HMI & SCADA network', anchor: [.45, 1.39, -.16], side: 'right' },
  { id: 'relays', label: 'Interface relays', note: 'Isolated outputs to the field', anchor: [-.35, .93, -.17], side: 'left' },
  { id: 'isolators', label: 'Signal isolators', note: 'Clean analog signals from instruments', anchor: [.31, .93, -.15], side: 'right' },
  { id: 'terminals', label: 'Terminal blocks & ferruled wiring', note: 'Labelled, traceable connections', anchor: [0, .5, -.2], side: 'left' },
  { id: 'ducts', label: 'Cable ducts', note: 'Segregated power & control routing', anchor: [.69, .62, -.18], side: 'right' }
];

export const stages = [
  { id: 'arrival', label: 'The factory floor', target: [-.8, .3, -.8], direction: [1, .72, 1.05], height: 16, mobileTarget: [0, .6, .2], mobileWidth: 13.5, mobileY: -.04, placement: [.2, .04], anchor: [-3.3, 5.6, .7], annotation: 'STOCKYARD / STACKER + RECLAIMER', detail: 'An illustrative stacker and reclaimer stockyard. It is not a replica of a specific client plant or of the ACS facility.' },
  { id: 'production', label: 'The plant, under control', target: [.6, 2.1, 1.8], direction: [.55, .45, 1], height: 11.6, mobileTarget: [-.6, 2, 1.8], mobileWidth: 14, placement: [.23, -.01], anchor: [5.6, 2.25, 1.1], annotation: 'ACS PANEL / RUNNING 24×7', detail: 'A stacker and reclaimer stockyard (boom stacker, bucket-wheel reclaimer, yard conveyor and junction house) coordinated by one PLC control panel. Illustrative scene, not a client installation.' },
  { id: 'panel', label: 'The control panel', target: [5.62, 1.1, 1], direction: [.62, .26, 1], height: 3.1, mobileWidth: 2.7, mobileY: -.05, mobileFill: .55, placement: [.2, .02], anchor: [5.95, 1.62, 1.33], annotation: 'HMI / INDICATION / EMERGENCY STOP', detail: 'Representative ACS two-door PLC panel with door-mounted HMI, indication and emergency controls. Every panel is engineered to its project specification.' },
  { id: 'inside', label: 'Inside the panel', callouts: true, doorOpen: 1, target: [5.6, 1.12, 1], direction: [.05, .12, 1], height: 4.4, mobileWidth: 2.4, mobileY: -.06, mobileFill: .62, placement: [.165, .02], anchor: [5.6, 1.12, .9], annotation: 'ACS / INSIDE THE PANEL', detail: 'Component layout is illustrative. Makes, ratings and arrangement are selected and engineered for each project.' },
  { id: 'always-on', label: 'Built for 24×7', target: [2.6, 1.1, -3.4], direction: [-.3, .8, 1], height: 6, mobileTarget: [3.2, 1.1, -3.6], mobileWidth: 8.4, mobileY: -.08, mobileFill: .5, placement: [.2, .02], anchor: [2.6, 2.45, -4.9], annotation: 'COMPARTMENTAL MCC / ROUND THE CLOCK', detail: 'Representative compartmental MCC and PLC panel, based on ACS panel photography.' },
  { id: 'experience', label: 'The ACS team', target: [0, .8, 0], direction: [-.7, 1.1, 1], height: 20, mobileWidth: 20, placement: [0, 0], anchor: [0, 0, 0], annotation: 'ACS / PEOPLE + SUPPORT', detail: 'Published ACS credentials and experience since 2009.' },
  { id: 'capabilities', label: 'Capabilities', target: [-.5, .8, -.5], direction: [.9, 1.25, .75], height: 17, mobileWidth: 19, placement: [-.08, .08], anchor: [0, 0, 0], annotation: 'ACS / CAPABILITIES', detail: 'Stated ACS manufacturing capacity, engineering tools and standards.' },
  { id: 'contact', label: 'Your process, our starting point', target: [5.2, 1.1, .4], direction: [.55, .5, 1], height: 7.2, mobileTarget: [5.4, 1.1, .6], mobileWidth: 8, mobileY: -.15, mobileFill: .5, placement: [.25, .04], anchor: [5.6, 2.3, 1], annotation: 'YOUR PROCESS / ACS ENGINEERING', detail: 'Process understanding starts the engineering conversation.' }
];
