// Positions, bounds and anchors remain stable when approved GLBs replace schematic actors.
export const modelSlots = {
  cabinet: { modelUrl: null, size: [2.9, 3.5, 1.1], position: [0, 0, 0], reference: 'assets/acs/control-panels.jpg', status: 'NEEDS CONFIRMATION: dimensions, exterior and internal layout.' },
  field: { modelUrl: null, size: [.85, 1.4, .65], position: [3.2, 0, 2.1], reference: null, status: 'Schematic signal interface; not a specified ACS product.' },
  power: { modelUrl: null, size: [3.7, 2.8, .9], position: [-4.1, 0, -1.5], reference: 'assets/acs/vfd-panel.jpg', status: 'NEEDS CONFIRMATION: approved lineup and bay dimensions.' },
  data: { modelUrl: null, size: [2.9, 2.4, .3], position: [4.2, 0, -2.1], reference: 'assets/home-journey/media/ems.jpg', status: 'Schematic display plane with actual ACS interface; not live data.' },
  installation: { modelUrl: null, size: [12, .15, 8], position: [0, 0, 0], reference: null, status: 'Conceptual installation base, not an ACS factory replica.' }
};
export const stages = [
  { id: 'arrival', label: 'The complete system', actor: 'cabinet', target: [0, 1.35, 0], offset: [7, 5, 10], height: 9.5, mobileWidth: 8.6, anchor: [0, 3.25, .65], annotation: 'CONTROL / ACS ENGINEERING', detail: 'One connected installation. Schematic volumes reserve the positions of approved future models.' },
  { id: 'field', label: 'Field input', actor: 'field', target: [2.6, .9, 1.7], offset: [5, 3.8, 8], height: 4.6, mobileWidth: 3.2, anchor: [3.2, 1.25, 2.45], annotation: 'INPUT / SIGNAL INTERFACE', detail: 'Plant instrumentation supplies signals used by the control system. This enclosure is schematic, not a specified component.' },
  { id: 'control', label: 'Control & inspection', actor: 'cabinet', target: [0, 1.55, .2], offset: [3, 2.2, 10], height: 7.2, mobileWidth: 6, anchor: [0, 2.4, .25], annotation: 'LOGIC / PANEL ENGINEERING', detail: 'Control, connection and routing zones represent roles within a cabinet. Exact component layouts await approved references.' },
  { id: 'power', label: 'Power & drive', actor: 'power', target: [-4.1, 1.3, -1.5], offset: [5, 3.3, 10], height: 6, mobileWidth: 4.7, anchor: [-4.1, 2.65, -1], annotation: 'OUTPUT / MCC + VFD', detail: 'A modular lineup represents ACS motor-control and drive-panel engineering. No ratings or component models are implied.' },
  { id: 'data', label: 'Data & monitoring', actor: 'data', target: [4.2, 1.35, -2.1], offset: [1.5, 1.4, 10], height: 4.8, mobileWidth: 3.8, anchor: [4.2, 2.55, -1.95], annotation: 'VISIBILITY / ACS SOFTWARE', detail: 'Actual ACS software imagery is displayed on a schematic spatial surface. It is an existing interface, not live operational data.' },
  { id: 'installation', label: 'Complete execution', actor: 'installation', target: [0, 2, 0], offset: [9, 9, 12], height: 13, mobileWidth: 12.5, anchor: [0, .05, 3.9], annotation: 'DELIVERY / CONNECTED EXECUTION', detail: 'A conceptual installation unites the system roles. It is not a digital twin or the ACS facility layout.' }
];
