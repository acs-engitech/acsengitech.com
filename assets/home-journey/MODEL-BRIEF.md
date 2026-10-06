# ACS homepage model handoff

The active homepage uses world-scene.js and stages.js. Every object is real Three.js geometry built in code (no photo or SVG substitutes). The old home.js and scene.js remain inactive.

## Journey

Factory floor → production line with its control panel → the closed ACS panel → doors open with component callouts → "Panels that work 24×7" → ACS team → capabilities (2300 I/O proof) → enquiry.

`stages` in stages.js owns each chapter's camera (target, view direction, framed height, desktop placement, mobile framing), annotation anchor, door state (`doorOpen`) and whether the interior callouts show (`callouts`). Chapter IDs match the `<section>` IDs in index.html.

## Model slots

- factory: cut-away hall (floor, walls, columns, rafters, high-bay lights), pallet racking, two CNC machining centres and an operator desk showing the real EMS and LogView images. Illustrative, NOT the ACS facility or a client plant.
- line: packaging line with belt conveyor, guarded machine stations, inspection arch, robot palletiser (2-link IK, synchronised to the carton pitch), safety fence and cable tray back to the panel.
- panel: hero two-door enclosure modelled on assets/acs/control-panels.jpg: door HMI, indication lamps, E-stop, meter, louvres; interior mounting plate with MCCB incomer, busbars, PLC + I/O, MCBs, 24 V supplies, VFDs, contactors/overloads, terminal strip, ducts and wiring. Layout is illustrative; makes and ratings are not asserted.
- mcc: nine-section MCC / VFD lineup modelled on assets/acs/vfd-panel.jpg.

Callouts are defined in `callouts` (stages.js) with panel-local anchors; showroom.js draws the HTML labels and leader lines from projected points every frame.

## Rendering

Perspective camera, ACES tone mapping, procedural studio reflections (PMREM), soft directional shadows and canvas-generated textures (floor, belt, cartons, HMI, meter, nameplate, hazard tape). Static meshes are merged per material at build time (`bake`), so hundreds of parts render in a few dozen draw calls; animated parts are flagged `userData.live`. Ambient motion (conveyor, robot, press, blinking LEDs) runs only while the stage is visible and is frozen for reduced-motion users. CPU-only WebGL (SwiftShader / llvmpipe) gets no shadow pass and 1× pixels.

## Replacing an actor with a GLB

Use an uncompressed, self-contained GLB with Y-up and a ground-level origin, no cameras, lights or staging floor, standard glTF materials. Set the slot's `modelUrl`; the model is fitted to the slot `size` at the slot position and the procedural actor stays if loading fails. Panel door animation requires pivots named ACS_Door_Left and ACS_Door_Right on the hinge axis; without them the door button is hidden. Review callout anchors after swapping the panel.

## Fallback renders

world-*-desktop.png (1440×872) and world-*-mobile.png (390×776) are direct captures of this scene, one per chapter, used for WebGL failure and no-JavaScript. Regenerate them after any model or staging change with `mount.setReviewStage(index)` followed by `mount.captureWorld()`, and verify at 320, 390, 768, 1024, 1440 and 1920 widths.

Three.js 0.160.1 remains locally vendored with its MIT license. No new rendering dependency was added.
