# Erlenwacht architecture

`index.html` is a static entry point with a pinned Three.js import map. `src/main.js` loads the game and reports startup errors. The same relative paths work from a GitHub Pages subdirectory.

## Modules

| Directory | Responsibility | Extension point |
| --- | --- | --- |
| `src/engine` | 60 Hz simulation, rendering and adaptive pixel ratio | Supply game update and render callbacks |
| `src/world` | Seeded scenery, terrain, collision, paths and encounter anchors | Add terrain and scenery builders or new encounter layouts |
| `src/character` | Motion, avatar with procedural animation, orbit camera and device input | Add actions to the input adapter and motion states to the character |
| `src/combat` | Encounter behavior, target rules, rune cooldown and defeat events | Add archetypes or introduce skills in `src/combat/skills.js` |
| `src/inventory` | Item definitions, capacity, stacks, equipment and bag dialog | Add item definitions and equipment effects |
| `src/game` | Session orchestration, starter tutorial, classes, professions, wayfires, expedition, loot, XP and save | Extend catalogs and anchors or supply another persistence adapter |
| `src/ui` | Health, objective, performance and interaction feedback | Render state supplied by the session |

A fixed step samples inputs, updates character motion and camera, checks the checkpoint and interactions, runs combat, and updates loot and feedback. The world provides terrain contact and collision for both enemies and the player. The inventory model publishes changes to the bag and session. The session translates combat defeat events into world drops and translates equip effects into combat parameters.

## Rendering

Scenery uses instanced, spatially grouped meshes. Two lights are reused for nearby lanterns. The Aschenpass adds landmark layouts, gathering props and a walkable reed bridge. The renderer adapts the pixel ratio after sustained drops in frame rate. Closed scenery and terrain are represented by world collision shapes and height sampling.

## Persistence

Save format v1 uses one localStorage snapshot for quest progress, class, profession XP, gathering timers, wayfires, character XP, skill ranks, inventory, permanent encounter defeats and outstanding loot. Older saves retain their quest and encounter progress and receive a default class. Permanent encounter IDs remain stable. Repeatable encounters respawn on a timer and store no permanent defeat records.

This is a client-side simulation suited to a static host. Shared worlds will require server-owned state for movement validation, combat, loot and inventory. Keep renderer and input separate when replacing the local session authority.

## Gameplay check

Run from a nested URL. Verify keyboard and portrait touch movement, choose a class, harvest a resource and make a recipe at the workbench. Follow the beacons, travel to Glutlager and back, and use both class abilities before collecting a drop. Follow the road to the gate, talk to the guard, and verify the Relic Warden and Northmark quests. Reload to verify the class, recipe progress, wayfires, inventory and skill ranks.
