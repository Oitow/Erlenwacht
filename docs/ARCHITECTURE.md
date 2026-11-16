# Erlenwacht architecture

## Present state
- `main`: project charter and issue plan.
- `integration/migration`: standalone experimental `index.html` prototype (not full PAG migration).
- Source game: `Oitow/pag/games/enklave`, importing many modules under `Oitow/pag/engine`.

## Intended module contracts
- `world`: deterministic seed, terrain chunks, props, encounter anchors.
- `character`: transform, velocity, animation state, actions.
- `combat`: skill definitions, targeting, cast policy, cooldowns, damage events.
- `inventory`: items, containers, stack rules, persistence.
- `render`: meshes, optional SDF shaders and splat overlays.
- `ui`: mobile portrait HUD, input, panels and accessibility.

## Rendering priorities
Start with mesh terrain and collision; splats are optional visual layers, not game geometry. SDF shaders should be GPU-budgeted and disabled on low-end hardware. Build fallback modes and measure memory, frame pacing and shader compile time.

## Testing checklist
Load from GitHub Pages-relative paths, confirm no console errors, check portrait Android touch, desktop WASD, spell and enemy feedback, camera tracking, FPS and memory. Test the lowest quality setting before integrating advanced rendering.
