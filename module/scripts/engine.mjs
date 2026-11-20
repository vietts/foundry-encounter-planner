/**
 * Encounter Planner — the maths, without Foundry.
 * Everything here is an expected-value estimate: average numbers, no dice.
 */

/* XP by CR (2024 rules; same as CONFIG.DND5E.CR_EXP_LEVELS for integer CRs). */
const XP_BY_CR = [10, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000,
  15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000];

/* XP budget per character: [Low, Moderate, High] (2024 rules; same as CONFIG.DND5E.ENCOUNTER_DIFFICULTY). */
export const XP_BUDGET_2024 = [[0, 0, 0], [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500],
  [500, 750, 1100], [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600],
  [1600, 2300, 3100], [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200],
  [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200],
  [6400, 13200, 22000]];

/* Adventuring-day XP per character (2014 DMG): reference only, the 2024 rules dropped it. */
export const ADVENTURING_DAY_2014 = [0, 300, 600, 1200, 1700, 3500, 4000, 5000, 6000, 7500, 9000, 10500, 11500, 13500,
  15000, 18000, 20000, 25000, 27000, 30000, 40000];

/* Typical monster by CR (2014 DMG monster-creation table): average damage per round and attack bonus. */
const MONSTER_BY_CR = {
  0: [1, 3], 0.125: [2.5, 3], 0.25: [4.5, 3], 0.5: [7, 3], 1: [11.5, 3], 2: [17.5, 3], 3: [23.5, 4], 4: [29.5, 5],
  5: [35.5, 6], 6: [41.5, 6], 7: [47.5, 6], 8: [53.5, 7], 9: [59.5, 7], 10: [65.5, 7], 11: [71.5, 8], 12: [77.5, 8],
  13: [83.5, 8], 14: [89.5, 8], 15: [95.5, 8], 16: [101.5, 9], 17: [107.5, 10], 18: [113.5, 10], 19: [119.5, 10],
  20: [131.5, 10], 21: [149.5, 11], 22: [167.5, 11], 23: [185.5, 11], 24: [203.5, 12], 25: [221.5, 12],
  26: [239.5, 12], 27: [257.5, 13], 28: [275.5, 13], 29: [293.5, 13], 30: [311.5, 14]
};

/* Average damage per round of a PC if every attack hits, by level (table estimate, editable per PC in the UI). */
const PC_DAMAGE_BY_LEVEL = [0, 8, 9, 11, 12, 19, 20, 21, 23, 25, 26, 32, 33, 34, 35, 37, 38, 44, 45, 46, 48];

/* How hard a class hits compared to the average (dnd5e class identifiers). */
const CLASS_WEIGHT = {
  barbarian: 1.15, fighter: 1.15, paladin: 1.2, ranger: 1.05, rogue: 1.05, monk: 1.0, warlock: 1.0,
  sorcerer: 0.9, wizard: 0.85, artificer: 0.9, cleric: 0.85, druid: 0.8, bard: 0.75
};

/* Magical healing over a day (HP) per class level: Lay on Hands 5×level, the others a rough guess. */
const CLASS_HEALING = { paladin: 5, cleric: 4, druid: 3, bard: 2.5 };

export function crNumber(cr) {
  if (typeof cr === "number") return cr;
  if (cr == null || cr === "") return null;
  const s = String(cr).trim();
  if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return b ? a / b : null; }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function crLabel(cr) {
  const n = crNumber(cr);
  if (n == null) return "—";
  return { 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" }[n] ?? String(n);
}

export function xpForCr(cr) {
  const n = crNumber(cr);
  if (n == null) return 0;
  if (n === 0) return 10;
  if (n < 1) return Math.round(200 * n);       // 1/8 → 25, 1/4 → 50, 1/2 → 100
  return XP_BY_CR[Math.min(Math.round(n), 30)] ?? 0;
}

export function monsterStatsForCr(cr) {
  const n = crNumber(cr) ?? 0;
  const keys = Object.keys(MONSTER_BY_CR).map(Number).sort((a, b) => a - b);
  const k = keys.reduce((best, c) => (c <= n ? c : best), 0);
  const [damage, attack] = MONSTER_BY_CR[k];
  return { damage, attack };
}

export const pcAttackBonus = level => {
  const prof = 2 + Math.floor((Math.max(1, level) - 1) / 4);
  const mod = level >= 8 ? 5 : level >= 4 ? 4 : 3;
  return prof + mod;
};

/** Starting estimate for a PC from level and classes ({identifier: levels}). */
export function estimatePc({ level, classes = {} }) {
  const total = Object.values(classes).reduce((a, b) => a + b, 0) || 1;
  const weight = Object.entries(classes).reduce((s, [id, lvl]) => s + (CLASS_WEIGHT[id] ?? 1) * lvl, 0) / total;
  const healing = Object.entries(classes).reduce((s, [id, lvl]) => s + (CLASS_HEALING[id] ?? 0) * lvl, 0);
  return {
    damage: Math.round(PC_DAMAGE_BY_LEVEL[Math.min(Math.max(level, 1), 20)] * weight * 10) / 10,
    attack: pcAttackBonus(level),
    healing: Math.round(healing)
  };
}

export const hitChance = (attack, ac) => Math.min(0.95, Math.max(0.05, (21 + attack - ac) / 20));

/** 2024 difficulty of an encounter for a party: levels = [level of each PC]. key: none|low|moderate|high|beyond */
export function difficulty(xp, levels) {
  const thresholds = [0, 1, 2].map(i => levels.reduce((s, l) => s + (XP_BUDGET_2024[Math.min(Math.max(l, 0), 20)]?.[i] ?? 0), 0));
  let key = "none";
  if (xp > thresholds[2]) key = "beyond";
  else if (xp > thresholds[1]) key = "high";
  else if (xp > thresholds[0]) key = "moderate";
  else if (xp > 0) key = "low";
  return { key, thresholds };
}

/**
 * One fight in expected values, round by round.
 * pcs: [{id, hp, hpMax, ac, damage, attack}] (hp = HP at the start of the fight)
 * monsters: [{name, hp, ac, damage, attack}] one entry per creature
 * opts: {efficiency, lethality} multipliers (1 = 100%)
 * The party focuses the monster that deals the most damage per HP; monster damage is spread over the PCs still
 * standing in proportion to their max HP. A PC at 0 HP no longer attacks.
 */
export function fight(pcs, monsters, { efficiency = 1, lethality = 1, maxRounds = 20 } = {}) {
  const state = pcs.map(p => ({ ...p }));
  const enemies = monsters.map(m => ({ ...m, left: m.hp }))
    .sort((a, b) => (b.damage / Math.max(b.hp, 1)) - (a.damage / Math.max(a.hp, 1)));
  const avgAc = state.reduce((s, p) => s + p.ac * p.hpMax, 0) / Math.max(1, state.reduce((s, p) => s + p.hpMax, 0));
  let rounds = 0, damageTaken = 0;
  const alive = () => enemies.filter(n => n.left > 0);
  const standing = () => state.filter(p => p.hp > 0);
  while (alive().length && standing().length && rounds < maxRounds) {
    rounds++;
    // Damage from the monsters alive at the start of the round
    let monsterDamage = alive().reduce((s, n) => s + n.damage * hitChance(n.attack, avgAc), 0) * lethality;
    // Party damage (from whoever is still standing)
    const target = alive()[0];
    let partyDamage = 0;
    for (const p of standing()) partyDamage += p.damage * hitChance(p.attack, target.ac) * efficiency;
    // Apply party damage in order, the excess carries over; a monster dropped this round deals half damage
    let rest = partyDamage, saved = 0;
    for (const n of alive()) {
      if (rest <= 0) break;
      const before = n.left;
      n.left = Math.max(0, n.left - rest);
      rest -= before - n.left;
      if (n.left === 0) saved += n.damage * hitChance(n.attack, avgAc) * lethality * 0.5;
    }
    monsterDamage -= saved;
    // Spread over the PCs still standing
    const up = standing();
    const totalMax = up.reduce((s, p) => s + p.hpMax, 0);
    for (const p of up) {
      const before = p.hp;
      p.hp = Math.max(0, p.hp - monsterDamage * p.hpMax / totalMax);
      damageTaken += before - p.hp;
    }
  }
  return {
    rounds,
    won: alive().length === 0,
    stalemate: alive().length > 0 && standing().length > 0,
    damageTaken: Math.round(damageTaken),
    pcs: state
  };
}

/**
 * An adventuring day: encounters in a row, optional short rests (hit dice) and magical healing between fights.
 * party: [{id, name, hpMax, hp, ac, damage, attack, hitDice: {n, avg}, healing}]
 * encounters: [{name, monsters: [...], shortRest: bool}]
 */
export function adventuringDay(party, encounters, opts = {}) {
  let pcs = party.map(p => ({ ...p, hd: p.hitDice?.n ?? 0 }));
  let healing = party.reduce((s, p) => s + (p.healing ?? 0), 0);
  const hpMaxTotal = party.reduce((s, p) => s + p.hpMax, 0);
  const results = [];
  let fallenAt = null;
  for (const [i, enc] of encounters.entries()) {
    if (!enc.monsters.length) { results.push({ empty: true }); continue; }
    const hpBefore = pcs.reduce((s, p) => s + p.hp, 0);
    const r = fight(pcs, enc.monsters, opts);
    pcs = pcs.map((p, j) => ({ ...p, hp: r.pcs[j].hp }));
    const hpEnd = pcs.reduce((s, p) => s + p.hp, 0);
    const down = pcs.filter(p => p.hp <= 0).map(p => p.name);
    // After the fight: whoever is down gets back up with healing, then the short rest, then healing up to full
    let healingUsed = 0, hitDiceUsed = 0;
    const heal = (p, amount) => { const c = Math.min(amount, healing, p.hpMax - p.hp); p.hp += c; healing -= c; healingUsed += c; };
    if (!r.won) fallenAt ??= i;
    if (r.won) {
      for (const p of pcs) if (p.hp <= 0) heal(p, 1);
      if (enc.shortRest) {
        for (const p of pcs) {
          while (p.hd > 0 && p.hpMax - p.hp >= p.hitDice.avg * 0.75) { p.hp = Math.min(p.hpMax, p.hp + p.hitDice.avg); p.hd--; hitDiceUsed++; }
        }
      }
      if (i < encounters.length - 1) for (const p of pcs) heal(p, p.hpMax - p.hp);
    }
    const share = hpEnd / hpMaxTotal;
    results.push({
      rounds: r.rounds, won: r.won, stalemate: r.stalemate, damage: r.damageTaken,
      hpBefore: Math.round(hpBefore), hpEnd: Math.round(hpEnd), hpAfter: Math.round(pcs.reduce((s, p) => s + p.hp, 0)),
      share, down, healingUsed: Math.round(healingUsed), hitDiceUsed,
      risk: !r.won ? "dead" : (down.length || share < 0.25) ? "red" : share < 0.5 ? "yellow" : "green"
    });
    if (!r.won) break;
  }
  return {
    results, fallenAt, hpMaxTotal,
    healingLeft: Math.round(healing),
    hitDiceLeft: pcs.reduce((s, p) => s + p.hd, 0),
    hpFinal: Math.round(pcs.reduce((s, p) => s + p.hp, 0))
  };
}

/** How many times in a row the party survives the same encounter (no one down at the end), with or without short rests. */
export function howManyInARow(party, monsters, { shortRest = false, ...opts } = {}, max = 15) {
  const encounters = Array.from({ length: max }, (_, i) => ({ name: `#${i + 1}`, monsters, shortRest }));
  const day = adventuringDay(party, encounters, opts);
  let n = 0;
  for (const e of day.results) { if (!e.won || e.down.length) break; n++; }
  return { n, max };
}
