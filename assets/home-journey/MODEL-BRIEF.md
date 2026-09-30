# ACS homepage model handoff

The active homepage uses world-scene.js and stages.js. These are real Three.js schematic actors, not photo or SVG substitutes. The old home.js and scene.js remain inactive.

## Model slots

- process: opening process schematic with vessels, flow, a motor, valve and operator interface. It explains industrial relationships, not a particular ACS machine or installation. NEEDS CONFIRMATION: approved process layout and equipment references. Replace through modelSlots.process.
- cabinet: main actor in engineering inspection and manufacturing, then part of the commissioned system. Reference assets/acs/control-panels.jpg. NEEDS CONFIRMATION: dimensions, side/rear/closed views, door pivots and approved internal layout.
- field: schematic signal interface. NEEDS CONFIRMATION: actual enclosure reference before presenting it as a specific product.
- power: modular MCC/VFD lineup. Reference assets/acs/vfd-panel.jpg; assets/acs/mcc-panel.jpg is an alternative, not an interchangeable product. NEEDS CONFIRMATION: selected lineup and bay dimensions.
- data: spatial display surface, currently showing actual EMS screenshot or LogView architecture. No claim that the conceptual support/enclosure is an ACS product.
- installation: shared floor, model footprints and anchored signal routes. No verified facility CAD or photography is available; this is NOT an ACS factory replica.

## Asset delivery

The lifecycle order is process understanding, control architecture, engineering, manufacturing/testing, power integration, programming/monitoring, commissioning, support and enquiry. Existing chapter anchors are retained. Each stage explicitly lists visible actors and its inspection/software/door state; sequencing no longer depends on hard-coded actor indices. The architecture and commissioning views connect the whole system. Only the conceptual process appears at arrival.

The manufacturing photograph is separate evidence, never the cabinet fallback. On mobile it remains available in the scope dialog. The floor and process schematic are not representations of the verified 36,000 sq. ft. facility. Do not label either as a factory tour or project digital twin.

Use an uncompressed, self-contained GLB with Y-up and a ground-level origin. Export actual-scale geometry where known. Include no cameras, staging floor, environment or lights. Use standard glTF materials. Compression decoders are not currently bundled.

Set the appropriate modelSlots entry in stages.js. The host retains its world position and the approved object is fitted within that slot's bounds. The schematic actor remains during download or failure. Camera targets and annotation anchors remain independent of model geometry; review their alignment after swapping.

Cabinet animation requires named door pivots: ACS_Door_Left and ACS_Door_Right, with each pivot on the hinge axis. Confirm rotation direction against the source cabinet. Without those pivots the door control is disabled for that asset. Internal inspection groups may use ACS_Control, ACS_Connections and ACS_Routing.

Reference photographs must guide manual/CAD modeling. One image cannot establish hidden geometry. Do not invent component make, model, ratings, exact wiring, factory context or client attribution.

## Matched fallback renders

world-*-desktop.png and world-*-mobile.png are direct captures of this same Three.js installation. Reduced-motion users retain real 3D with discrete static camera states. Only WebGL failure or no-JavaScript uses the corresponding render. No old product photograph replaces a model slot.

After a model/staging change, regenerate the nine matched scene captures (arrival through enquiry) and verify them at 320, 390, 768, 1024, 1440 and 1920 widths. Test load failure, context loss, touch scrolling, keyboard controls and annotation alignment. The stage manifest owns camera targets, composition offsets, anchors and model slots; proof and enquiry remain inside the same scene timeline.

Three.js 0.160.1 remains locally vendored with its MIT license. No new rendering dependency was added.
