/**
 * Encounter Planner for D&D 5e — a GM window: party from the world, monsters from the compendiums you choose,
 * 2024 difficulty and a simulated adventuring day (how many encounters before the party falls). No tokens needed.
 */
import * as E from "./engine.mjs";

const ID = "dnd5e-encounter-planner";
const L = (key, data) => (data ? game.i18n.format(`EP.${key}`, data) : game.i18n.localize(`EP.${key}`));
const newEncounter = n => ({ id: foundry.utils.randomID(), name: L("Encounter.Default", { n }), monsters: [], shortRest: false });
const emptyPlan = () => ({ encounters: [], excluded: [], overrides: {}, opts: { efficiency: 1, lethality: 1, fullHp: true }, active: null });

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const fmt = n => Math.round(n).toLocaleString(game.i18n.lang);
const ICON = "icons/svg/mystery-man.svg";
/** First image usable in an <img>: no empty values, no wildcard (random) token paths. */
const image = (...src) => src.find(x => typeof x === "string" && x && !x.includes("*")) ?? ICON;

/* ---------------- Party ---------------- */

function partyMembers() {
  const party = game.actors.party
    ?? game.actors.find(a => a.type === "group" && (a.system.members?.length ?? a.system.members?.size));
  let actors = [];
  if (party) actors = [...party.system.members].map(m => m.actor ?? m).filter(a => a?.type === "character");
  if (!actors.length) actors = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
  return { party, actors };
}

function pcSheet(a, override = {}, fullHp = true) {
  const sys = a.system;
  const level = num(sys.details?.level, 1) || 1;
  const classes = {};
  let hdN = 0, hdSum = 0;
  for (const c of Object.values(a.classes ?? {})) {
    const lvl = num(c.system.levels, 0);
    classes[c.system.identifier ?? c.identifier ?? c.name] = lvl;
    const die = num(String(c.system.hd?.denomination ?? c.system.hitDice ?? "d8").replace("d", ""), 8);
    hdN += lvl; hdSum += (die / 2 + 0.5) * lvl;
  }
  const con = num(sys.abilities?.con?.mod, 0);
  const estimate = E.estimatePc({ level, classes });
  const hpMax = Math.max(1, num(sys.attributes?.hp?.max, 1));
  return {
    id: a.id, name: a.name, img: a.img, level, classes, estimate,
    hpMax, hp: fullHp ? hpMax : Math.max(0, num(sys.attributes?.hp?.value, hpMax)),
    ac: num(sys.attributes?.ac?.value, 12),
    damage: override.damage ?? estimate.damage, attack: override.attack ?? estimate.attack, healing: override.healing ?? estimate.healing,
    hitDice: { n: hdN, avg: Math.max(1, (hdN ? hdSum / hdN : 4.5) + con) }
  };
}

/* ---------------- Monster sources ---------------- */

const defaultSource = () => (game.settings.get("dnd5e", "rulesVersion") === "legacy" ? "dnd5e.monsters" : "dnd5e.actors24");
function sourcePacks() {
  const chosen = (game.settings.get(ID, "sources") ?? []).filter(id => game.packs.has(id));
  const ids = chosen.length ? chosen : [defaultSource()];
  return ids.map(id => game.packs.get(id)).filter(Boolean);
}
const fromSources = (uuid, packs) => packs.some(p => uuid.startsWith(`Compendium.${p.collection}.`));

let INDEX = null;
async function monsterIndex() {
  if (INDEX) return INDEX;
  const entries = [];
  const packs = sourcePacks();
  if (!packs.length) ui.notifications.warn(L("Sources.Missing", { pack: defaultSource() }));
  for (const pack of packs) {
    const idx = await pack.getIndex({ fields: ["type", "system.details.cr"] });
    for (const e of idx) if (e.type === "npc") entries.push({ uuid: e.uuid, name: e.name, cr: E.crNumber(foundry.utils.getProperty(e, "system.details.cr")), source: pack.title, img: image(e.img) });
  }
  // World NPCs that are not copies of a source monster (your own NPCs)
  for (const a of game.actors.filter(a => a.type === "npc" && !fromSources(a._stats?.compendiumSource ?? "", packs)))
    entries.push({ uuid: a.uuid, name: a.name, cr: E.crNumber(a.system.details?.cr), source: L("Search.World"), world: true, img: image(a.img, a.prototypeToken?.texture?.src) });
  entries.sort((a, b) => (!!a.world - !!b.world) || a.name.localeCompare(b.name, game.i18n.lang));
  return (INDEX = entries);
}

/** A monster dropped from another compendium is matched to the chosen sources (same id, then same name). */
async function matchToSources(uuid) {
  const packs = sourcePacks();
  if (!uuid.startsWith("Compendium.") || fromSources(uuid, packs)) return uuid;
  const id = uuid.split(".").pop();
  const doc = await fromUuid(uuid);
  const name = doc?.name?.toLowerCase();
  for (const pack of packs) {
    const idx = await pack.getIndex();
    const hit = idx.get(id) ?? idx.find(e => e.name.toLowerCase() === name);
    if (hit) {
      ui.notifications.info(L("Sources.Mapped", { from: doc?.name ?? id, to: hit.name, pack: pack.title }));
      return hit.uuid ?? `Compendium.${pack.collection}.Actor.${hit._id}`;
    }
  }
  ui.notifications.warn(L("Sources.NotFound", { name: doc?.name ?? id, pack: uuid.split(".").slice(1, 3).join(".") }));
  return uuid;
}

async function monsterData(uuid) {
  const d = await fromUuid(uuid);
  if (!d || d.documentName !== "Actor") return null;
  const s = d.system;
  return {
    uuid, name: d.name, img: image(d.prototypeToken?.texture?.src, d.img),
    cr: E.crNumber(s.details?.cr) ?? 0,
    hp: Math.max(1, num(s.attributes?.hp?.max, 1)),
    ac: num(s.attributes?.ac?.value ?? s.attributes?.ac?.flat, 12),
    n: 1
  };
}

const expand = monsters => monsters.flatMap(m => {
  const base = E.monsterStatsForCr(m.cr);
  return Array.from({ length: Math.max(0, m.n) }, () => ({ name: m.name, hp: m.hp, ac: m.ac, damage: base.damage, attack: base.attack }));
});

/* ---------------- Window ---------------- */

const { ApplicationV2 } = foundry.applications.api;

class EncounterPlanner extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: ID,
    classes: [ID],
    window: { title: "EP.Title", icon: "fa-solid fa-scale-balanced", resizable: true },
    position: { width: 1120, height: 780 }
  };

  plan = (() => {
    const p = foundry.utils.mergeObject(emptyPlan(), game.settings.get(ID, "plan") ?? {}, { inplace: false });
    if (!p.encounters.length) p.encounters.push(newEncounter(1));
    return p;
  })();
  query = "";
  crFilter = "";
  repeats = {};

  get active() {
    return this.plan.encounters.find(i => i.id === this.plan.active) ?? this.plan.encounters.at(-1);
  }

  monsterImage(m) {
    const a = m.world ? fromUuidSync(m.world) : null;
    return a ? image(a.prototypeToken?.texture?.src, a.img) : image(m.img);
  }

  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => game.settings.set(ID, "plan", this.plan), 400);
  }

  party() {
    const { party, actors } = partyMembers();
    const all = actors.map(a => pcSheet(a, this.plan.overrides[a.id], this.plan.opts.fullHp));
    return { party, all, playing: all.filter(p => !this.plan.excluded.includes(p.id)) };
  }

  async _renderHTML() {
    const { party, all, playing } = this.party();
    const levels = playing.map(p => p.level);
    const opts = this.plan.opts;
    const day = E.adventuringDay(playing, this.plan.encounters.map(i => ({ ...i, monsters: expand(i.monsters) })), opts);
    const xpDay = this.plan.encounters.reduce((s, i) => s + i.monsters.reduce((t, m) => t + E.xpForCr(m.cr) * m.n, 0), 0);
    const budget2014 = levels.reduce((s, l) => s + (E.ADVENTURING_DAY_2014[l] ?? 0), 0);
    const thresholds = [0, 1, 2].map(k => levels.reduce((s, l) => s + E.XP_BUDGET_2024[Math.min(l, 20)][k], 0));
    const S = k => L(`Short.${k}`);

    const pcRows = all.map(p => {
      const out = this.plan.excluded.includes(p.id);
      const ov = this.plan.overrides[p.id] ?? {};
      const field = (k, v, est, step = 0.5) => `<input type="number" step="${step}" data-override="${k}" data-pc="${p.id}" value="${v}" class="${ov[k] != null ? "overridden" : ""}" title="${esc(L("Party.EstimateHint", { value: est }))}">`;
      return `<tr class="${out ? "out" : ""}">
        <td><input type="checkbox" data-include="${p.id}" ${out ? "" : "checked"}></td>
        <td class="name"><img src="${esc(image(p.img))}"> ${esc(p.name)}</td>
        <td>${p.level}</td><td>${p.hpMax}</td><td>${p.ac}</td>
        <td>${field("damage", p.damage, p.estimate.damage)}</td><td>${field("attack", p.attack, p.estimate.attack, 1)}</td>
        <td>${field("healing", p.healing, p.estimate.healing, 1)}</td><td>${p.hitDice.n}×${p.hitDice.avg.toFixed(1)}</td></tr>`;
    }).join("");

    const cards = this.plan.encounters.map((enc, i) => {
      const xp = enc.monsters.reduce((s, m) => s + E.xpForCr(m.cr) * m.n, 0);
      const diff = E.difficulty(xp, levels);
      const r = day.results[i];
      const rep = this.repeats[enc.id];
      const hasActor = !!game.actors.get(enc.actor);
      let result = `<span class="risk grey">${L("Risk.notReached")}</span>`;
      if (r?.empty) result = `<span class="risk grey">${L("Risk.empty")}</span>`;
      else if (r) {
        const label = r.risk === "dead" && r.stalemate ? L("Risk.stalemate") : L(`Risk.${r.risk}`);
        const extra = [r.hitDiceUsed ? L("HitDiceUsed", { n: r.hitDiceUsed }) : "", r.healingUsed ? L("HealingUsed", { n: fmt(r.healingUsed) }) : ""].filter(Boolean);
        result = `<span class="risk ${r.risk}">${label}</span>
          <span class="detail">${L("Result", { rounds: r.rounds, damage: fmt(r.damage), hp: fmt(r.hpEnd), max: fmt(day.hpMaxTotal) })}${extra.map(x => ` · ${x}`).join("")}</span>`;
      }
      const rows = enc.monsters.map((m, j) => `<li>
          <img src="${esc(this.monsterImage(m))}"><span class="name" title="${esc(m.uuid)}">${esc(m.name)}</span>
          <span class="cr">${S("CR")} ${E.crLabel(m.cr)}</span><span>${S("HP")} ${m.hp}</span><span>${S("AC")} ${m.ac}</span>
          <span class="qty"><button data-action-ep="minus" data-i="${i}" data-j="${j}">−</button><b>${m.n}</b><button data-action-ep="plus" data-i="${i}" data-j="${j}">+</button></span>
          <button class="icon" data-action-ep="edit" data-i="${i}" data-j="${j}" title="${esc(L("Encounter.Edit"))}"><i class="fa-solid fa-pen"></i></button>
          <button class="icon" data-action-ep="removeMonster" data-i="${i}" data-j="${j}" title="${esc(L("Encounter.Remove"))}">✕</button></li>`).join("");
      return `<section class="encounter ${enc.id === this.active?.id ? "active" : ""}" data-encounter="${enc.id}">
        <header>
          <input class="enc-name" data-name="${i}" value="${esc(enc.name)}">
          <span class="diff ${diff.key}">${L(`Difficulty.${diff.key}`)}</span><span class="xp">${fmt(xp)} XP</span>
          <span class="spacer"></span>
          <button data-action-ep="up" data-i="${i}" title="${esc(L("Encounter.Up"))}">▲</button><button data-action-ep="down" data-i="${i}" title="${esc(L("Encounter.Down"))}">▼</button>
          <button data-action-ep="duplicate" data-i="${i}" title="${esc(L("Encounter.Duplicate"))}">⧉</button><button data-action-ep="deleteEncounter" data-i="${i}" title="${esc(L("Encounter.Delete"))}">✕</button>
        </header>
        <div class="result-row">${result}</div>
        <ul class="monsters">${rows || `<li class="empty">${L("Encounter.Drop")}</li>`}</ul>
        <footer>
          <label><input type="checkbox" data-rest="${i}" ${enc.shortRest ? "checked" : ""}> ${L("Encounter.ShortRest")}</label>
          <span class="spacer"></span>
          <button data-action-ep="repeat" data-i="${i}" ${enc.monsters.length ? "" : "disabled"}>${L("Encounter.Repeat")}</button>
          <button data-action-ep="create" data-i="${i}" ${enc.monsters.length ? "" : "disabled"} title="${esc(L("Encounter.CreateHint"))}"><i class="fa-solid fa-dragon"></i> ${L(hasActor ? "Encounter.Update" : "Encounter.Create")}</button>
          ${hasActor ? `<button data-action-ep="openSheet" data-i="${i}" title="${esc(L("Encounter.OpenSheet"))}"><i class="fa-solid fa-up-right-from-square"></i></button>` : ""}
          <button data-action-ep="place" data-i="${i}" ${enc.monsters.length && canvas?.scene ? "" : "disabled"} title="${esc(L("Encounter.PlaceHint"))}"><i class="fa-solid fa-chess-knight"></i> ${L("Encounter.Place")}</button>
          ${rep ? `<span class="repeat">${rep}</span>` : ""}
        </footer></section>`;
    }).join("");

    const bars = this.plan.encounters.map((enc, i) => {
      const r = day.results[i];
      const q = r && !r.empty ? Math.max(0, r.hpEnd / day.hpMaxTotal) : null;
      return `<div class="bar ${r?.risk ?? "grey"}" title="${esc(enc.name)}"><div class="fill" style="height:${q == null ? 0 : Math.round(q * 100)}%"></div><span>${i + 1}</span></div>`;
    }).join("");
    const fallen = day.fallenAt != null ? this.plan.encounters[day.fallenAt] : null;
    const verdict = !playing.length ? L("Party.None")
      : fallen ? L("Verdict.Fall", { n: day.fallenAt + 1, name: esc(fallen.name) })
      : L("Verdict.Survive", { hp: fmt(day.hpFinal), max: fmt(day.hpMaxTotal), pct: Math.round(day.hpFinal / Math.max(1, day.hpMaxTotal) * 100), healing: fmt(day.healingLeft), hd: day.hitDiceLeft });

    const crOptions = ["0", "1/8", "1/4", "1/2", ...Array.from({ length: 30 }, (_, k) => String(k + 1))]
      .map(g => `<option ${this.crFilter === g ? "selected" : ""}>${g}</option>`).join("");

    return `
      <div class="ep-top">
        <details class="party" ${this._partyOpen === false ? "" : "open"}>
          <summary>${esc(L("Party.Summary", { name: party?.name ?? L("Party.PlayerCharacters"), count: playing.length, levels: levels.join(", ") || "—" }))} ·
            ${L("Party.Thresholds")} <span class="diff low">${L("Difficulty.low")} ${fmt(thresholds[0])}</span> <span class="diff moderate">${L("Difficulty.moderate")} ${fmt(thresholds[1])}</span> <span class="diff high">${L("Difficulty.high")} ${fmt(thresholds[2])}</span></summary>
          <table><thead><tr><th></th><th>${L("Party.PC")}</th><th>${L("Party.Level")}</th><th>${L("Party.HP")}</th><th>${L("Party.AC")}</th>
            <th title="${esc(L("Party.DamageHint"))}">${L("Party.Damage")}</th><th>${L("Party.Attack")}</th>
            <th title="${esc(L("Party.HealingHint"))}">${L("Party.Healing")}</th><th>${L("Party.HitDice")}</th></tr></thead>
          <tbody>${pcRows}</tbody></table>
          <div class="opts">
            <label>${L("Party.Efficiency")} <input type="range" min="0.5" max="1.5" step="0.05" data-opt="efficiency" value="${opts.efficiency}"> <b>${Math.round(opts.efficiency * 100)}%</b></label>
            <label>${L("Party.Lethality")} <input type="range" min="0.5" max="1.5" step="0.05" data-opt="lethality" value="${opts.lethality}"> <b>${Math.round(opts.lethality * 100)}%</b></label>
            <label><input type="checkbox" data-opt="fullHp" ${opts.fullHp ? "checked" : ""}> ${L("Party.FullHP")}</label>
          </div>
        </details>
      </div>
      <div class="ep-body">
        <div class="encounters">
          <div class="day">
            <div class="bars">${bars}</div>
            <div class="verdict">${verdict}<br><small>${L("Verdict.Xp", { xp: fmt(xpDay), budget: fmt(budget2014) })}</small></div>
          </div>
          ${cards}
          <div class="actions"><button data-action-ep="new"><i class="fa-solid fa-plus"></i> ${L("Encounter.New")}</button>
          <button data-action-ep="reset"><i class="fa-solid fa-broom"></i> ${L("Encounter.Reset")}</button></div>
        </div>
        <aside class="search">
          <div class="filters"><input type="search" placeholder="${esc(L("Search.Placeholder"))}" value="${esc(this.query)}" data-query>
            <select data-crfilter title="${esc(L("Search.CR"))}"><option value="">${L("Search.CR")}</option>${crOptions}</select></div>
          <div class="add-to">${L("Search.AddTo", { name: esc(this.active?.name ?? "—") })}</div>
          <ul class="results"></ul>
        </aside>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    this.refreshResults();
  }

  async refreshResults() {
    const ul = this.element?.querySelector(".results");
    if (!ul) return;
    const entries = await monsterIndex();
    const q = this.query.trim().toLowerCase();
    const cr = this.crFilter ? E.crNumber(this.crFilter) : null;
    const found = entries.filter(v => (!q || v.name.toLowerCase().includes(q)) && (cr == null || v.cr === cr)).slice(0, 60);
    ul.innerHTML = found.map(v => `<li data-add="${esc(v.uuid)}" draggable="true" title="${esc(v.source)}">
      <img src="${esc(v.img)}"><span class="name">${esc(v.name)}</span><span class="cr">${L("Short.CR")} ${E.crLabel(v.cr)}</span><span class="source">${esc(v.source)}</span></li>`).join("")
      || `<li class="empty">${q || cr != null ? L("Search.NoResults") : L("Search.Hint")}</li>`;
  }

  async add(uuid, encounterId) {
    uuid = await matchToSources(uuid);
    const enc = this.plan.encounters.find(i => i.id === encounterId) ?? this.active;
    if (!enc) return;
    const existing = enc.monsters.find(m => m.uuid === uuid);
    if (existing) existing.n++;
    else {
      const m = await monsterData(uuid);
      if (!m) return ui.notifications.warn(L("Encounter.OnlyActors"));
      enc.monsters.push(m);
    }
    this.plan.active = enc.id;
    delete this.repeats[enc.id];
    this.save(); this.render();
  }

  /** «Encounters» and «Encounters › Monsters» folders, found by flag (so renaming them is fine). */
  async folders() {
    const find = (role, parent) => game.folders.find(f => f.type === "Actor" && f.getFlag(ID, "role") === role && (parent ? f.folder?.id === parent.id : true));
    const encounters = find("encounters") ?? await Folder.create({ name: L("Folders.Encounters"), type: "Actor", color: "#8b1e1e", sorting: "m", flags: { [ID]: { role: "encounters" } } });
    const monsters = find("monsters", encounters) ?? await Folder.create({ name: L("Folders.Monsters"), type: "Actor", folder: encounters.id, sorting: "a", flags: { [ID]: { role: "monsters" } } });
    return { encounters, monsters };
  }

  /** The world copy of a monster: imported from its compendium the first time, then always reused (shared by all encounters). */
  async worldCopy(m) {
    const { monsters } = await this.folders();
    const a = await dnd5e.documents.Actor5e.fetchExisting(m.uuid, { folderId: monsters.id });
    if (a.pack == null && !a.getFlag("dnd5e", "isAutoImported") && (a._stats?.compendiumSource === m.uuid)) await a.setFlag("dnd5e", "isAutoImported", true);
    m.world = a.uuid;
    return a;
  }

  /** Create or update the dnd5e Encounter actor. Its members are the world copies, so portraits and tokens can be changed before placing. */
  async createEncounter(enc, { place = false } = {}) {
    if (!enc?.monsters.length) return;
    const { encounters: folder } = await this.folders();
    const members = [];
    for (const m of enc.monsters.filter(m => m.n > 0)) {
      const a = await this.worldCopy(m);
      members.push({ uuid: a.uuid, quantity: { value: m.n } });
    }
    let actor = game.actors.get(enc.actor);
    if (actor) await actor.update({ name: enc.name, "system.members": members });
    else {
      actor = await Actor.create({ name: enc.name, type: "encounter", folder: folder.id, img: image(enc.monsters[0]?.img), system: { members } });
      enc.actor = actor.id;
    }
    this.save();
    if (place) {
      if (!canvas?.scene) return ui.notifications.warn(L("Encounter.OpenScene"));
      this.minimize?.();
      try { await actor.system.placeMembers(); } finally { this.maximize?.(); }
    } else ui.notifications.info(L("Encounter.Ready", { name: actor.name }));
    this.render();
  }

  async editMonster(m) {
    const a = await this.worldCopy(m);
    this.save();
    a.sheet.render(true);
    this.render();
  }

  _onRender() {
    if (this._bound === this.element) return;   // once per element (it is recreated when the window reopens)
    this._bound = this.element;
    const el = this.element;
    el.addEventListener("click", ev => this.#onClick(ev));
    el.addEventListener("change", ev => this.#onChange(ev));
    el.addEventListener("input", ev => {
      if (ev.target.matches("[data-query]")) { this.query = ev.target.value; this.refreshResults(); }
    });
    el.addEventListener("toggle", ev => { if (ev.target.matches("details.party")) this._partyOpen = ev.target.open; }, true);
    el.addEventListener("dragstart", ev => {
      const li = ev.target.closest?.("[data-add]");
      if (li) ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Actor", uuid: li.dataset.add }));
    });
    el.addEventListener("dragover", ev => ev.preventDefault());
    el.addEventListener("drop", ev => {
      ev.preventDefault();
      let data; try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
      if (data?.type !== "Actor" || !data.uuid) return;
      this.add(data.uuid, ev.target.closest("[data-encounter]")?.dataset.encounter);
    });
  }

  #onClick(ev) {
    const t = ev.target;
    const li = t.closest("[data-add]");
    if (li) return this.add(li.dataset.add);
    const b = t.closest("button[data-action-ep]");
    const card = t.closest("[data-encounter]");
    if (!b) {
      if (card && card.dataset.encounter !== this.plan.active && !t.closest("input,label,select,button,summary")) {
        this.plan.active = card.dataset.encounter; this.save(); this.render();
      }
      return;
    }
    const i = num(b.dataset.i), j = num(b.dataset.j);
    const list = this.plan.encounters, enc = list[i];
    switch (b.dataset.actionEp) {
      case "plus": enc.monsters[j].n++; break;
      case "minus": enc.monsters[j].n = Math.max(0, enc.monsters[j].n - 1); if (!enc.monsters[j].n) enc.monsters.splice(j, 1); break;
      case "removeMonster": enc.monsters.splice(j, 1); break;
      case "up": if (i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]]; break;
      case "down": if (i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]]; break;
      case "duplicate": {
        const c = foundry.utils.deepClone(enc);
        c.id = foundry.utils.randomID(); c.name = L("Encounter.Copy", { name: enc.name }); delete c.actor;
        list.splice(i + 1, 0, c); this.plan.active = c.id; break;
      }
      case "deleteEncounter": list.splice(i, 1); if (!list.length) list.push(newEncounter(1)); break;
      case "new": { const n = newEncounter(list.length + 1); list.push(n); this.plan.active = n.id; break; }
      case "reset": this.plan.encounters = [newEncounter(1)]; this.plan.active = null; this.repeats = {}; break;
      case "create": return this.createEncounter(enc);
      case "place": return this.createEncounter(enc, { place: true });
      case "edit": return this.editMonster(enc.monsters[j]);
      case "openSheet": return game.actors.get(enc.actor)?.sheet.render(true);
      case "repeat": {
        const { playing } = this.party();
        const monsters = expand(enc.monsters);
        const a = E.howManyInARow(playing, monsters, { ...this.plan.opts, shortRest: false });
        const r = E.howManyInARow(playing, monsters, { ...this.plan.opts, shortRest: true });
        const say = q => (q.n >= q.max ? `${q.max}+` : `${q.n}`);
        this.repeats[enc.id] = L("Encounter.RepeatResult", { a: say(a), b: say(r) });
        return this.render();
      }
      default: return;
    }
    if (enc) delete this.repeats[enc.id];
    this.save(); this.render();
  }

  #onChange(ev) {
    const t = ev.target, d = t.dataset;
    if (d.include) {
      const s = new Set(this.plan.excluded);
      t.checked ? s.delete(d.include) : s.add(d.include);
      this.plan.excluded = [...s];
    } else if (d.override) {
      const o = (this.plan.overrides[d.pc] ??= {});
      if (t.value === "") delete o[d.override]; else o[d.override] = num(t.value);
    } else if (d.opt) {
      this.plan.opts[d.opt] = t.type === "checkbox" ? t.checked : num(t.value, 1);
    } else if (d.rest != null) {
      this.plan.encounters[num(d.rest)].shortRest = t.checked;
    } else if (d.name != null) {
      this.plan.encounters[num(d.name)].name = t.value;
    } else if (t.matches("[data-crfilter]")) {
      this.crFilter = t.value; return this.refreshResults();
    } else return;
    this.repeats = {};
    this.save(); this.render();
  }
}

/* ---------------- Monster compendiums setting ---------------- */

class SourcesConfig extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-sources`,
    tag: "form",
    window: { title: "EP.Sources.Name", icon: "fa-solid fa-book" },
    position: { width: 480 },
    form: { handler: SourcesConfig.#onSubmit, closeOnSubmit: true }
  };

  async _renderHTML() {
    const chosen = new Set(game.settings.get(ID, "sources") ?? []);
    const packs = game.packs.filter(p => p.documentName === "Actor").sort((a, b) => a.title.localeCompare(b.title, game.i18n.lang));
    const rows = packs.map(p => `<label class="ep-source"><input type="checkbox" data-pack="${esc(p.collection)}" ${chosen.has(p.collection) ? "checked" : ""}>
      <span>${esc(p.title)}</span> <small>${esc(p.collection)}</small></label>`).join("");
    return `<p class="hint">${L("Sources.Hint")}</p>
      <p><i>${esc(L("Sources.Auto", { pack: defaultSource() }))}</i></p>
      <div class="ep-sources">${rows}</div>
      <footer class="form-footer"><button type="submit"><i class="fa-solid fa-save"></i> ${L("Sources.Save")}</button></footer>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  static async #onSubmit(event, form) {
    const ids = [...form.querySelectorAll("input[data-pack]:checked")].map(i => i.dataset.pack);
    await game.settings.set(ID, "sources", ids);
  }
}

/* ---------------- Boot ---------------- */

let planner = null;
function open() {
  if (!game.user.isGM) return ui.notifications.warn(L("GMOnly"));
  planner ??= new EncounterPlanner();
  planner.render({ force: true });
  return planner;
}

Hooks.once("init", () => {
  game.settings.register(ID, "plan", { scope: "world", config: false, type: Object, default: emptyPlan() });
  game.settings.register(ID, "sources", { scope: "world", config: false, type: Array, default: [], onChange: () => { INDEX = null; } });
  game.settings.registerMenu(ID, "sourcesMenu", {
    name: "EP.Sources.Name", label: "EP.Sources.Label", hint: "EP.Sources.Hint",
    icon: "fa-solid fa-book", type: SourcesConfig, restricted: true
  });
});

Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`.${ID}-open`)) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = `${ID}-open`;
  b.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> ${L("Open")}`;
  b.addEventListener("click", open);
  (root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root).append(b);
});

Hooks.on("createActor", () => { INDEX = null; });
Hooks.on("deleteActor", () => { INDEX = null; });
// Portrait or token changed on a world copy: refresh the window
Hooks.on("updateActor", a => {
  if (planner?.rendered && planner.plan.encounters.some(i => i.monsters.some(m => m.world === a.uuid))) planner.render();
});
Hooks.once("ready", () => { game.modules.get(ID).api = { open, engine: E }; });
