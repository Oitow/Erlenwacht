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
| `src/game` | Session orchestration, tutorial, expedition, loot, XP and save | Extend the quest flow or supply another persistence adapter |
| `src/ui` | Health, objective, performance and interaction feedback | Render state supplied by the session |
| `src/online` | WebSocket client and remote avatar presentation | Add room events and project them into the scene |
| `server` | Optional static host and room relay | Move gameplay rules to server-owned simulation before sharing combat |

A fixed step samples inputs, updates character motion and camera, checks the checkpoint and interactions, runs combat, and updates loot and feedback. The world provides terrain contact and collision for both enemies and the player. The inventory model publishes changes to the bag and session. The session translates combat defeat events into world drops and translates equip effects into combat parameters.

## Rendering

Scenery uses instanced, spatially grouped meshes. Two lights are reused for nearby lanterns. The renderer adapts the pixel ratio after sustained drops in frame rate. Closed scenery and terrain are represented by world collision shapes and height sampling.

## Persistence

Save format v1 uses one localStorage snapshot for quest progress, XP, skill ranks, bag contents, equipment, auto-cast preference, permanent encounter defeats, and outstanding loot. XP is initialized from recorded forest kills when the saved game predates progression. The quest and expedition progress select the checkpoint on reload. Keep the original numeric encounter IDs stable for save compatibility. Give new encounters explicit IDs. Repeatable encounters respawn on a timer and store no permanent defeat records.

## Online rooms

The web client starts offline and a player can join a room from the menu. The relay assigns session IDs, manages room membership and broadcasts text chat to room members. It accepts bounded client poses for avatar presentation, sends nearby-player snapshots, and expires dead connections. The client clears remote avatars on disconnect and can reconnect after a transient interruption. It does not upload local saves.

Protocol v1 sends `join`, `pose` and `chat` from the client. The server responds with `welcome`, `snapshot`, `chat` or `error`. A snapshot is a complete view of nearby remote players, along with the total room member count. The game uses it to remove peers that leave or move out of range. Chat uses the server-assigned session identity.

The offline game loop owns combat, loot, inventory and progression. A shared gameplay simulation will need server-owned movement, encounters and character state, along with durable accounts.

## Gameplay check

Run from a nested URL. Verify keyboard and portrait touch movement, camera orbit, jump, and manual and auto spell casts. Collect the first drop, follow the lanterns to the gate, talk to the guard and equip the reward. Break the Relic Warden's shield, turn in the contract, follow the expedition landmarks and defeat the Watchkeeper. Upgrade a skill, equip the amulet, and reload to verify the saved checkpoint, equipment and ranks. Check death, respawn and the local chat commands.
