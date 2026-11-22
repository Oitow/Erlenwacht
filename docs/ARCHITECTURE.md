# Erlenwacht architecture

`index.html` is a static entry point with a pinned Three.js import map. `src/main.js` loads the game and reports startup errors. The same relative paths work from a GitHub Pages subdirectory.

## Modules

| Directory | Responsibility | Extension point |
| --- | --- | --- |
| `src/engine` | 60 Hz simulation, rendering and adaptive pixel ratio | Supply game update and render callbacks |
| `src/world` | Seeded scenery, terrain, collision, paths and encounter anchors | Add terrain and scenery builders or new encounter layouts |
| `src/character` | Motion, avatar with procedural animation, orbit camera and device input | Add actions to the input adapter and motion states to the character |
| `src/combat` | Encounter behavior, target rules, rune cooldown and defeat events | Add archetypes or introduce additional skills alongside Rune Burst |
| `src/inventory` | Item definitions, capacity, stacks, equipment and bag dialog | Add item definitions and equipment effects |
| `src/game` | Session orchestration, quest, checkpoint, loot and save | Extend the quest flow or supply another persistence adapter |
| `src/ui` | Health, objective, performance and interaction feedback | Render state supplied by the session |

A fixed step samples inputs, updates character motion and camera, checks the checkpoint and interactions, runs combat, and updates loot and feedback. The world provides terrain contact and collision for both enemies and the player. The inventory model publishes changes to the bag and session. The session translates combat defeat events into world drops and translates equip effects into combat parameters.

## Rendering

Scenery uses instanced, spatially grouped meshes. Two lights are reused for nearby lanterns. The renderer adapts the pixel ratio after sustained drops in frame rate. Closed scenery and terrain are represented by world collision shapes and height sampling.

## Persistence

Save format v1 writes a single localStorage snapshot for quest progress, bag contents, equipped item, auto-cast preference, defeated encounter IDs, and uncollected world drops. The quest determines the spawn or enclave checkpoint on reload. Health and camera orientation reset there. Encounter IDs are currently array indexes. Append new anchors or migrate the save format before reordering existing anchors.

This is a client-side simulation suited to a static host. Shared worlds will require server-owned state for movement validation, combat, loot and inventory. Keep renderer and input separate when replacing the local session authority.

## Gameplay check

Run from a nested URL. Verify keyboard and portrait touch movement, camera orbit, jump, manual and auto spell casts. Follow the lanterns through the gate, collect a drop, talk to the guard, equip the reward and reload to verify the checkpoint and inventory. Check the death and respawn loop separately.
