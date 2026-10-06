// Positions, bounds and anchors remain stable when approved GLBs replace the procedural actors.
export const modelSlots = {
  factory: { modelUrl: null, size: [36, 7.5, 22], position: [0, 0, 0], reference: null, status: 'Illustrative factory floor. Not a replica of a specific client plant or of the ACS facility.' },
  line: { modelUrl: null, size: [14, 3.2, 4.2], position: [0, 0, 0], reference: null, status: 'Illustrative packaging line: conveyor, machine stations and robot palletiser.' },
  panel: { modelUrl: null, size: [1.6, 2.15, .62], position: [5.6, 0, 1], reference: 'assets/acs/control-panels.jpg', status: 'Representative ACS-style control panel. Component layout is illustrative; every project is engineered to its own specification.' },
  mcc: { modelUrl: null, size: [7.4, 2.35, .65], position: [2.6, 0, -5.2], reference: 'assets/acs/vfd-panel.jpg', status: 'Representative MCC / VFD lineup based on ACS panel photography.' }
};

// Door-open callouts. Anchors are in panel-local metres; side decides which edge the label sits on.
export const callouts = [
  { id: 'incomer', label: 'Main incomer', note: 'MCCB isolation & protection', anchor: [-.5, 1.81, -.12], side: 'left' },
  { id: 'busbar', label: 'Copper busbars', note: 'Power distribution to every feeder', anchor: [.2, 1.85, -.17], side: 'right' },
  { id: 'plc', label: 'PLC & I/O modules', note: 'The logic that runs your line', anchor: [-.4, 1.39, -.15], side: 'left' },
  { id: 'smps', label: '24 V DC power supply', note: 'Clean control power', anchor: [.45, 1.39, -.14], side: 'right' },
  { id: 'vfd', label: 'Variable frequency drives', note: 'Smooth motor speed control', anchor: [-.39, .93, -.1], side: 'left' },
  { id: 'contactor', label: 'Contactors & overloads', note: 'Motor switching & protection', anchor: [.31, .93, -.15], side: 'right' },
  { id: 'terminals', label: 'Terminal blocks & ferruled wiring', note: 'Labelled, traceable connections', anchor: [0, .5, -.2], side: 'left' },
  { id: 'ducts', label: 'Cable ducts', note: 'Segregated power & control routing', anchor: [.69, .62, -.18], side: 'right' }
];

export const stages = [
  { id: 'arrival', label: 'The factory floor', target: [-.8, .3, -.8], direction: [1, .72, 1.05], height: 16, mobileTarget: [2, .6, .2], mobileWidth: 12.5, mobileY: -.04, placement: [.22, .07], anchor: [-4.4, 2.05, 1.6], annotation: 'FACTORY FLOOR / LINES + PANELS', detail: 'An illustrative factory floor. It is not a replica of a specific client plant or of the ACS facility.' },
  { id: 'production', label: 'Production, under control', target: [1.9, 1.05, 1.3], direction: [.5, .46, 1], height: 7.6, mobileTarget: [3.2, 1.1, 1.3], mobileWidth: 9, placement: [.1, -.01], anchor: [5.6, 2.25, 1.1], annotation: 'ACS PANEL / RUNNING 24×7', detail: 'A packaging line with conveyor, machine stations and robot palletiser, coordinated by one control panel. Illustrative scene, not a client installation.' },
  { id: 'panel', label: 'The control panel', target: [5.62, 1.1, 1], direction: [.62, .26, 1], height: 3.1, mobileWidth: 2.7, mobileY: -.05, placement: [.17, .02], anchor: [5.95, 1.62, 1.33], annotation: 'HMI / INDICATION / EMERGENCY STOP', detail: 'Representative ACS-style two-door enclosure with door-mounted HMI, indication and emergency controls. Every panel is engineered to its project specification.' },
  { id: 'inside', label: 'Inside the panel', callouts: true, doorOpen: 1, target: [5.6, 1.12, 1], direction: [.05, .12, 1], height: 3.15, mobileWidth: 2.4, mobileY: -.06, placement: [.1, .02], anchor: [5.6, 1.12, .9], annotation: 'ACS / INSIDE THE PANEL', detail: 'Component layout is illustrative. Makes, ratings and arrangement are selected and engineered for each project.' },
  { id: 'always-on', label: 'Built for 24×7', target: [2.6, 1.1, -1.8], direction: [-.42, .44, 1], height: 7, mobileTarget: [3.4, 1.1, -1.6], mobileWidth: 8.4, mobileY: -.08, placement: [-.18, .04], anchor: [2.6, 2.45, -4.9], annotation: 'MCC + VFD / ROUND THE CLOCK', detail: 'Representative MCC / VFD lineup and control panel. Illustrative scene based on ACS panel photography.' },
  { id: 'experience', label: 'The ACS team', target: [0, .8, 0], direction: [-.7, 1.1, 1], height: 20, mobileWidth: 20, placement: [0, 0], anchor: [0, 0, 0], annotation: 'ACS / PEOPLE + SUPPORT', detail: 'Published ACS credentials and experience since 2009.' },
  { id: 'capabilities', label: 'Beyond the panel', target: [-.5, .8, -.5], direction: [.9, 1.25, .75], height: 17, mobileWidth: 19, placement: [-.08, .08], anchor: [0, 0, 0], annotation: 'FMCG / COMMISSIONED SYSTEM', detail: '2300 I/O and one SCADA node are verified application facts. The factory scene is illustrative, not the project layout.' },
  { id: 'contact', label: 'Your process, our starting point', target: [4.3, 1.1, .9], direction: [-.62, .55, 1], height: 7, mobileTarget: [4.6, 1.1, .9], mobileWidth: 8, mobileY: -.15, placement: [-.2, .06], anchor: [5.6, 2.3, 1], annotation: 'YOUR PROCESS / ACS ENGINEERING', detail: 'Process understanding starts the engineering conversation.' }
];
