# Erlenwacht

Private dark-fantasy, mobile-first MMO prototype.

## Direction
A vast, atmospheric world with a polished Dammerwald tutorial passage leading to a populated enclave. Gritty art direction, strong light/shadow contrast, large-scale nature, smooth procedural characters, expressive AoE combat, auto-casting, meaningful skill trees, inventory and loot.

## Rendering experiments
- Meshes remain authoritative for collisions, navigation and gameplay.
- SDF experiments for procedural shapes, animation and spell visuals.
- Gaussian splatting is optional environment detail, with LOD, memory budgets and fallback for mobile browsers.

## Source migration
The existing Enklave prototype lives at [Oitow/pag/games/enklave](https://github.com/Oitow/pag/tree/main/games/enklave). It imports shared modules from PAG's engine; migrate the complete transitive dependencies before calling the standalone port playable. Do not replace the source repo.

## Workstreams
See [Issues](https://github.com/Oitow/Erlenwacht/issues). Keep experiments on branches and use reviewed pull requests; no automatic merges.

## Current status
Project planning initialized. Gameplay migration and playable build are not yet complete.
