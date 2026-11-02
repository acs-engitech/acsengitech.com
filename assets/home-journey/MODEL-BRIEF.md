# ACS homepage model handoff

The active homepage uses world-scene.js and stages.js. Every object is real Three.js geometry built in code (no photo or SVG substitutes). The old home.js and scene.js remain inactive.

## Journey

Covered stockyard → stacker and reclaimer plant with its PLC control panel → the closed ACS PLC panel in front of a compartmental MCC → doors open with PLC-panel component callouts → "Panels that work 24×7" → ACS team → capabilities (facility, stated capacity, tools and standards) → enquiry.

`stages` in stages.js owns each chapter's camera (target, view direction, framed height, desktop placement, mobile framing), annotation anchor, door state (`doorOpen`) and whether the interior callouts show (`callouts`). Chapter IDs match the `<section>` IDs in index.html.

## Model slots

- factory: cut-away stockyard shed (floor, walls, columns, rafters, high-bay lights), walkway markings and an operator desk showing the real EMS and LogView images. Illustrative, NOT the ACS facility or a client plant.
- line: stacker and reclaimer stockyard: coal and ore stockpiles (noisy height-fields), rail track with end stops and cable trench, rail-mounted bucket-wheel reclaimer (travel bogies, cable reel, slewing superstructure, lattice boom with belt, rotating bucket wheel, counterweight and stays) and boom stacker with discharge stream, yard conveyor with troughed idlers, pull-cord switches and head drive, tripper, junction house and inclined gallery conveyor; cable tray back to the panel.
- panel: hero two-door PLC control panel modelled on assets/acs/control-panels.jpg: door HMI, indication lamps, E-stop, meter, louvres; PLC-panel interior with isolator, 24 V supplies, MCB distribution, PLC CPU + I/O, Ethernet switch, interface relays, signal isolators, terminal strip, ducts and wiring. Layout is illustrative; ratings are not asserted.
- mcc: compartmental MCC modelled on ACS MCC photographs: top busbar chamber, incomer, five feeder columns of six modules (lamps, push-button, meter, rotary handle), louvred cable alleys and bottom chamber.

On desktop the story copy sits in one left column (`--copy-w` in world.css) and every chapter's `placement` frames its subject to the right of it; squarer screens pull the camera back so the horizontal extent stays the same. On phones showroom.js measures the gap between each chapter's title and story copy and passes it to the scene (`setZones`), which centres and scales the subject (`mobileFill`) inside that gap.

Callouts are defined in `callouts` (stages.js) with panel-local anchors; showroom.js draws the HTML labels and leader lines from projected points every frame.

## Rendering

Perspective camera, ACES tone mapping, procedural studio reflections (PMREM), soft directional shadows and canvas-generated textures (floor, conveyor belt load, caution labels, HMI, meter, nameplate, hazard tape). Static meshes are merged per material at build time (`bake`), so hundreds of parts render in a few dozen draw calls; animated parts are flagged `userData.live`. Ambient motion (bucket wheel, moving conveyor belts, blinking LEDs) runs only while the stage is visible and is frozen for reduced-motion users. CPU-only WebGL (SwiftShader / llvmpipe) gets no shadow pass and 1× pixels.

## Replacing an actor with a GLB

Use an uncompressed, self-contained GLB with Y-up and a ground-level origin, no cameras, lights or staging floor, standard glTF materials. Set the slot's `modelUrl`; the model is fitted to the slot `size` at the slot position and the procedural actor stays if loading fails. Panel door animation requires pivots named ACS_Door_Left and ACS_Door_Right on the hinge axis; without them the door button is hidden. Review callout anchors after swapping the panel.

## Fallback renders

world-*-desktop.png (1440×872) and world-*-mobile.png (390×776) are direct captures of this scene, one per chapter, used for WebGL failure and no-JavaScript. Regenerate them after any model or staging change with `mount.setReviewStage(index)` followed by `mount.captureWorld()`, and verify at 320, 390, 768, 1024, 1440 and 1920 widths.

Three.js 0.160.1 remains locally vendored with its MIT license. No new rendering dependency was added.
