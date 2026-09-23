// GLB replacements use Y-up, metre units and a centered origin. The loader fits them automatically.
// Keep modelUrl null until an approved, uncompressed GLB/GLTF asset is available.
export const stages = [
  { id: 'field', label: '01 / Field input', modelUrl: null, modelHeight: 2.7,
    fallback: 'assets/home-journey/media/engineering.jpg', alt: 'ACS electrical engineering drawings',
    caption: 'Power & control engineering / ACS drawings',
    annotation: 'Signal termination', detail: 'Field signals are terminated and routed into the control system.',
    modelLabel: 'Conceptual field junction box assembly', hotspot: [0.5, 0.25, 0.55] },
  { id: 'control', label: '02 / Control logic', modelUrl: null, modelHeight: 3.2,
    fallback: 'assets/home-journey/media/plc-mcc.jpg', alt: 'ACS PLC cum MCC panel with internal equipment visible',
    caption: 'PLC cum MCC panel / ACS panel range',
    annotation: 'PLC & I/O', detail: 'PLC logic processes inputs and coordinates outputs. HMI and SCADA provide operation and supervision.',
    modelLabel: 'Conceptual control cabinet with PLC and I/O modules', hotspot: [0.25, 0.6, 0.55] },
  { id: 'power', label: '03 / Power & drive', modelUrl: null, modelHeight: 2.8,
    fallback: 'assets/acs/vfd-panel.jpg', alt: 'ACS variable frequency drive panel lineup',
    caption: 'VFD panel lineup / ACS panel range',
    annotation: 'Variable frequency drive', detail: 'A VFD controls motor speed to suit the process. Panel engineering connects protection, control and power.',
    modelLabel: 'Conceptual variable frequency drive assembly', hotspot: [0.5, 0.5, 0.5] },
  { id: 'process', label: '04 / Process automation', modelUrl: null, modelHeight: 2.7,
    fallback: 'assets/home-journey/media/plc-mcc.jpg', alt: 'ACS PLC cum MCC panel for integrated control',
    caption: 'Integrated control / ACS panel reference',
    annotation: 'Coordinated equipment', detail: 'Sequencing and interlocks coordinate plant equipment. This schematic skid illustrates the system relationship, not a specific ACS installation.',
    modelLabel: 'Conceptual process skid illustrating connected equipment', hotspot: [0.65, 0.6, 0.25] },
  { id: 'data', label: '05 / Data & monitoring', modelUrl: null, modelHeight: 2.5,
    fallback: 'assets/home-journey/media/ems.jpg', alt: 'ACS energy monitoring software interface',
    caption: 'Energy monitoring / ACS software interface',
    annotation: 'Plant data visibility', detail: 'ACS energy monitoring and LogView support data visibility, trends and reporting. The displayed interface is an existing screenshot, not live data.',
    modelLabel: 'Conceptual industrial display showing the ACS energy monitoring interface', hotspot: [0.75, 0.5, 0.2] }
];
