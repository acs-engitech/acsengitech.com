# ACS homepage model handoff

The homepage currently uses five real-time, conceptual Three.js assemblies. These are labeled "Concept assembly / not to scale" and are not presented as installed ACS equipment. Existing ACS photography, drawings and the EMS screenshot supply the factual proof.

## Final assets needed

| Slot | Model | Reference to supply |
| --- | --- | --- |
| field | Junction box, removable lid, terminal rails, cable glands | Approved enclosure dimensions and front/interior photos |
| control | Control cabinet, separate door, PLC/I/O rails, wiring ducts | Approved ACS panel photos or CAD export; identify component families only when confirmed |
| power | Drive or MCC/VFD assembly, front controls and cooling fins | Approved product/CAD reference and permission to show vendor marks |
| process | Small process skid or machine module | Approved actual assembly; otherwise keep the clearly conceptual skid |
| data | Industrial display / monitoring console | Approved enclosure geometry; current screen uses the real ACS EMS image |

## Delivery and swap

- Prefer a self-contained `.glb`, Y-up, with real materials and sensible origins. `.gltf` also works with all referenced textures/buffers alongside it.
- Target under 1.5 MB and 40,000 triangles per model, one 1024px texture atlas where practical. Avoid embedded environments and cameras.
- Use standard glTF materials. Draco, Meshopt and KTX2 decoders are not bundled; provide uncompressed geometry and JPEG/PNG textures.
- Place files under this directory, then set the corresponding `modelUrl` in `stages.js` relative to `scene.js`, e.g. `./models/control.glb`.
- `modelHeight` is the fitted height. Width/depth are also capped to preserve framing. `hotspot` is a point in the centered, fitted model's local coordinates; check it after replacement.
- The existing assembly stays visible during loading or failure. Page content, navigation and the scroll sequence do not need rewriting.
- Check all five views and rotation at 390px and 1440px after an asset swap. Unbranded conceptual captions remain until the model's provenance is confirmed.

Three.js 0.160.1 is pinned and locally vendored with its MIT license. Manrope is locally hosted under the SIL OFL license. The four new reference images are unchanged copies of files already referenced by the existing ACS public pages.
