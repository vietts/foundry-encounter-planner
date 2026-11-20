import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../module/scripts/engine.mjs";

// A level-4 party of seven (one level 5), roughly what a real table looks like
const pc = (name, level, classes, hpMax, ac, die, con) => {
  const s = E.estimatePc({ level, classes });
  return { id: name, name, hpMax, hp: hpMax, ac, ...s, hitDice: { n: level, avg: die / 2 + 0.5 + con } };
};
const party = [
  pc("Fighter", 4, { fighter: 4 }, 47, 18, 10, 3), pc("Paladin", 5, { paladin: 5 }, 39, 18, 10, 3),
  pc("Ranger", 4, { ranger: 4 }, 36, 15, 10, 2), pc("Rogue", 4, { rogue: 4 }, 31, 13, 8, 2),
  pc("Bard", 4, { bard: 4 }, 31, 13, 8, 2), pc("Warlock", 4, { warlock: 4 }, 25, 15, 8, 2),
  pc("Wizard", 4, { wizard: 4 }, 24, 12, 6, 1)
];
const levels = [4, 5, 4, 4, 4, 4, 4];
const monster = (name, cr, hp, ac) => ({ name, hp, ac, ...E.monsterStatsForCr(cr) });

test("XP and CR", () => {
  assert.equal(E.xpForCr("1/8"), 25); assert.equal(E.xpForCr(0.25), 50); assert.equal(E.xpForCr(3), 700);
  assert.equal(E.xpForCr(0), 10); assert.equal(E.crLabel(0.5), "1/2"); assert.equal(E.crNumber("1/4"), 0.25);
});

test("2024 thresholds for the party", () => {
  const d = E.difficulty(0, levels);
  assert.deepEqual(d.thresholds, [6 * 250 + 500, 6 * 375 + 750, 6 * 500 + 1100]);
  assert.equal(d.key, "none");
  assert.equal(E.difficulty(1000, levels).key, "low");
  assert.equal(E.difficulty(3000, levels).key, "moderate");
  assert.equal(E.difficulty(5000, levels).key, "beyond");
});

test("three green hags: hard but won", () => {
  const r = E.fight(party, [1, 2, 3].map(() => monster("Green Hag", 3, 82, 17)));
  assert.ok(r.won); assert.ok(r.damageTaken > 50);
});

test("an adult red dragon wipes them", () => {
  const r = E.fight(party, [monster("Adult Red Dragon", 17, 256, 19)]);
  assert.equal(r.won, false);
});

test("a day, and how many in a row", () => {
  const wolves = [1, 2, 3, 4].map(() => monster("Wolf", 0.25, 11, 12));
  const day = E.adventuringDay(party, [
    { name: "Zombies", monsters: Array.from({ length: 8 }, () => monster("Zombie", 0.25, 15, 8)) },
    { name: "Wolves", monsters: wolves, shortRest: true },
    { name: "Hags", monsters: [1, 2, 3].map(() => monster("Green Hag", 3, 82, 17)) }
  ]);
  assert.equal(day.results.length, 3);
  assert.equal(day.fallenAt, null);
  const dragon = E.adventuringDay(party, [{ name: "Dragon", monsters: [monster("Adult Red Dragon", 17, 256, 19)] }]);
  assert.equal(dragon.fallenAt, 0);
  assert.ok(E.howManyInARow(party, wolves, { shortRest: true }).n >= E.howManyInARow(party, wolves).n);
});
