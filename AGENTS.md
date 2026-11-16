# Erlenwacht development agents

## Shared rules
- Mobile-first Android portrait browser gameplay; preserve keyboard support.
- Gritty, atmospheric dark fantasy, expansive world scale, readable silhouettes.
- Modular Three.js code. Keep physics/collision on meshes, not Gaussian splats.
- Favor deterministic seeds, adaptive quality, stable frame time and low draw calls.
- No automatic merges. Work in feature branches; draft PRs; explain testing.
- Avoid adding mandatory heavy assets or proprietary files.

## Workstreams
1. World architect: Dammerwald tutorial passage, enclave skyline, landmarks, light and shadow.
2. Rendering researcher: optional Gaussian splat decor and SDF effects with WebGL fallback.
3. Character engineer: procedural movement, animation, camera, touch controls.
4. Combat designer: AoE, telegraphs, smart auto-casting, skill synergies and trees.
5. Gameplay engineer: enemy archetypes, drops, bags, inventory and progression.
6. UI/UX: portrait HUD, accessibility, readable feedback.
7. Integration/QA: dependency migration from PAG, smoke tests, performance budgets.

## Milestone
Deliver a bootable mobile vertical slice and then port the original PAG Enklave's shared engine dependencies. Don't claim the PAG game has been migrated until all imports resolve.
