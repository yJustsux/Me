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
  const key = process.env.RIOT_API_KEY;
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
  const key = process.env.APEX_API_KEY;
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

let ok = true;
for (const fn of [updateLol, updateApex]) {
  try {
    await fn();
  } catch (e) {
    ok = false;
    console.error(`Fehler: ${e.message}`);
  }
}

data.updated = new Date().toISOString();
await writeFile(FILE, JSON.stringify(data, null, 2) + "\n");
if (!ok) console.log("Mindestens ein Abruf ist fehlgeschlagen – alte Werte wurden behalten.");
