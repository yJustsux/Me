// Holt die aktuellen Ränge und schreibt sie in data/ranks.json.
// Läuft in der GitHub Action. API-Keys kommen aus GitHub-Secrets (Umgebungsvariablen):
//   RIOT_API_KEY  – https://developer.riotgames.com
//   APEX_API_KEY  – https://portal.apexlegendsapi.com
// Fehlt ein Key oder schlägt ein Abruf fehl, bleiben die bisherigen (manuellen) Werte stehen.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/ranks.json", import.meta.url);
const data = JSON.parse(await readFile(FILE, "utf8"));
const game = (id) => data.games.find((g) => g.id === id);

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} – ${url.split("?")[0]}`);
  return res.json();
}

const cap = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);

async function updateLol() {
  const key = process.env.RIOT_API_KEY?.trim();
  if (!key) return console.log("LoL: kein RIOT_API_KEY – überspringe");
  const g = game("lol");
  const [name, tag] = g.account.split("#");
  const h = { "X-Riot-Token": key };
  const acc = await getJson(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    h
  );
  const entries = await getJson(
    `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${acc.puuid}`,
    h
  );
  const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  if (!solo) {
    Object.assign(g, { rank: "Unranked", division: "", points: "", extra: "", source: "live" });
  } else {
    const noDiv = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(solo.tier);
    const total = solo.wins + solo.losses;
    Object.assign(g, {
      rank: cap(solo.tier),
      division: noDiv ? "" : solo.rank,
      points: solo.leaguePoints,
      extra: `${solo.wins}W / ${solo.losses}L · ${total ? Math.round((solo.wins / total) * 100) : 0}% WR`,
      source: "live",
    });
  }
  console.log(`LoL: ${g.rank} ${g.division} ${g.points} LP`);
}

async function updateApex() {
  const key = process.env.APEX_API_KEY?.trim();
  if (!key) return console.log("Apex: kein APEX_API_KEY – überspringe");
  const g = game("apex");
  const res = await getJson(
    `https://api.mozambiquehe.re/bridge?auth=${encodeURIComponent(key)}&player=${encodeURIComponent(g.account)}&platform=PC`
  );
  const r = res?.global?.rank;
  if (!r) throw new Error("Apex: keine Rang-Daten in der Antwort");
  Object.assign(g, {
    rank: r.rankName,
    division: r.rankName === "Apex Predator" || r.rankName === "Master" ? "" : String(r.rankDiv ?? ""),
    points: r.rankScore,
    rankImg: r.rankImg || "",
    source: "live",
  });
  console.log(`Apex: ${g.rank} ${g.division} ${g.points} RP`);
}

// Rocket League: Es gibt keine offene API (tracker.gg gibt RL-Daten nicht frei)
// → Rang wird manuell in data/ranks.json gepflegt.

// --- Peak: höchsten je gesehenen Rang merken ---------------------------------
const TIERS = {
  lol: ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master", "grandmaster", "challenger"],
  apex: ["rookie", "bronze", "silver", "gold", "platinum", "diamond", "master", "apex predator"],
  rocketleague: ["bronze", "silver", "gold", "platinum", "diamond", "champion", "grand champion", "supersonic legend"],
};
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };

// Vergleichswert: [Stufe, Division (höher = besser), Punkte]
function score(id, r) {
  const tier = TIERS[id]?.indexOf(String(r.rank || "").toLowerCase()) ?? -1;
  if (tier < 0) return null;
  const div = String(r.division || "").toUpperCase();
  const n = ROMAN[div] ?? (Number(div) || 0);
  const divScore = id === "rocketleague" ? n : n ? 5 - n : 5; // LoL/Apex: Div 1 ist die beste
  return [tier, divScore, Number(r.points) || 0];
}
function higher(a, b) {
  if (!b) return true;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

function updatePeak(g) {
  const now = score(g.id, g);
  if (!now) return;
  const peak = g.peak && g.peak.rank ? score(g.id, g.peak) : null;
  if (higher(now, peak)) {
    g.peak = {
      rank: g.rank,
      division: g.division,
      points: g.points,
      note: `erreicht am ${new Date().toLocaleDateString("de-DE")}`,
    };
    console.log(`${g.name}: neuer Peak → ${g.rank} ${g.division}`);
  }
}

let ok = true;
for (const [id, fn] of [["lol", updateLol], ["apex", updateApex]]) {
  try {
    await fn();
    if (game(id).source === "live") updatePeak(game(id));
  } catch (e) {
    ok = false;
    console.error(`Fehler: ${e.message}`);
  }
}

data.updated = new Date().toISOString();
await writeFile(FILE, JSON.stringify(data, null, 2) + "\n");
if (!ok) console.log("Mindestens ein Abruf ist fehlgeschlagen – alte Werte wurden behalten.");
