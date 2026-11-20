# Encounter Planner (D&D 5e)

*[Italiano](README.it.md)*

A GM window for Foundry VTT and the **dnd5e** system: plan encounters **without placing tokens**, see how a whole
**adventuring day** plays out, then turn the plan into a dnd5e **Encounter** and drop it on the scene.

- **Party from the world** — the dnd5e primary party, or the first Group actor, or the player-owned characters.
  Untick a PC to leave them out; tweak their damage per round, attack bonus and daily healing (tweaked values get a gold outline, clear the field to go back to the estimate).
- **Monsters from the compendiums you choose** — search by name or CR, or drag an actor onto an encounter.
  By default the dnd5e SRD monsters for your world's rules (`dnd5e.actors24` for 2024 rules, `dnd5e.monsters` for legacy).
  Use **Settings › Encounter Planner › Monster compendiums** to hook up your own (Monster Manual module, a translated or homebrew compendium…).
  Monsters dropped from other compendiums are matched to your chosen ones by id or name, so every encounter draws from **one source**.
- **2024 difficulty** — Low / Moderate / High thresholds summed over the PCs you included.
- **The adventuring day** — encounters in a row, an optional short rest after each (hit dice), magical healing between fights.
  It tells you **in which encounter the party falls**, how many HP are left after each fight, and for any encounter
  **how many times in a row** they can take it, with and without short rests.
- **From plan to table** — *Create encounter* makes (or updates) a dnd5e Encounter actor in the *Encounters* folder.
  Its monsters are world copies in *Encounters › Monsters*, one per monster and shared by all encounters, so you can
  **change portraits and tokens before placing them** (the pencil next to each monster opens its copy).
  *Place* puts them on the current scene with dnd5e's own placement, and into the combat tracker according to the
  dnd5e setting for encounter placement.

Open it from the button at the top of the Actors sidebar, or with `game.modules.get("dnd5e-encounter-planner").api.open()`.

## How the estimate works

Expected values, no dice. It is meant to give you a feel, not a verdict.

- **Monsters:** real HP and AC from the sheet; damage per round and attack bonus from the typical-monster-by-CR table.
- **PCs:** damage per round from a per-level table weighted by class (editable), attack bonus = proficiency + 3/4/5.
- **The fight:** the party focuses the monster that deals the most damage per HP; monster damage is spread over the
  standing PCs in proportion to their max HP — which is why *deaths likely* already shows below 25% of the party's HP.
- Two sliders tune it to your table: **party efficiency** and **monster lethality**.

## Install

Manifest URL: `https://github.com/vietts/foundry-encounter-planner/releases/latest/download/module.json`

Requires Foundry VTT v13+ and dnd5e 5.0+ (Encounter actors). Interface in English and Italian.

## Development

`npm test` runs the tests of the maths (`module/scripts/engine.mjs`, no Foundry needed).
Release: publish a GitHub release tagged `vX.Y.Z`; the workflow builds `module.zip` and the manifest.

## License

MIT
