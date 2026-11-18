// Holt die aktuellen Ränge und schreibt sie in data/ranks.json.
// Läuft in der GitHub Action. API-Keys kommen aus GitHub-Secrets (Umgebungsvariablen):
//   RIOT_API_KEY  – https://developer.riotgames.com
//   APEX_API_KEY  – https://portal.apexlegendsapi.com
// Fehlt ein Key oder schlägt ein Abruf fehl, bleiben die bisherigen (manuellen) Werte stehen.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/ranks.json", import.meta.url);
const data = JSON.parse(await readFile(FILE, "utf8"));
const game = (id) => data.games.find((g) => g.id === id);
const LOL_MATCHES = 20; // so viele Ranked-Spiele fließen in die LoL-Durchschnittswerte ein

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
  const stats = [];
  if (!solo) {
    Object.assign(g, { rank: "Unranked", division: "", points: "", source: "live" });
  } else {
    const noDiv = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(solo.tier);
    const total = solo.wins + solo.losses;
    Object.assign(g, {
      rank: cap(solo.tier),
      division: noDiv ? "" : solo.rank,
      points: solo.leaguePoints,
      source: "live",
    });
    stats.push(
      { label: "Season W/L", value: `${solo.wins} / ${solo.losses}` },
      { label: "Winrate", value: `${total ? Math.round((solo.wins / total) * 100) : 0} %` }
    );
  }
  delete g.extra;
  console.log(`LoL: ${g.rank} ${g.division} ${g.points} LP`);

  // Level + Profilbild
  const summoner = await getJson(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${acc.puuid}`, h);
  const ddVer = (await getJson("https://ddragon.leagueoflegends.com/api/versions.json"))[0];
  g.level = summoner.summonerLevel;
  g.avatar = `https://ddragon.leagueoflegends.com/cdn/${ddVer}/img/profileicon/${summoner.profileIconId}.png`;

  // Durchschnittswerte aus den letzten Ranked-Solo/Duo-Spielen (Queue 420)
  const ids = await getJson(
    `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${acc.puuid}/ids?queue=420&count=${LOL_MATCHES}`,
    h
  );
  const games = [];
  for (const id of ids) {
    const m = await getJson(`https://europe.api.riotgames.com/lol/match/v5/matches/${id}`, h);
    const p = m.info.participants.find((x) => x.puuid === acc.puuid);
    if (!p || m.info.gameDuration < 300) continue; // Remakes ignorieren
    games.push({
      champ: p.championName,
      win: p.win,
      k: p.kills, d: p.deaths, a: p.assists,
      dmg: p.totalDamageDealtToChampions,
      cs: p.totalMinionsKilled + p.neutralMinionsKilled,
      min: m.info.gameDuration / 60,
    });
  }

  if (games.length) {
    const sum = (f) => games.reduce((s, x) => s + f(x), 0);
    const n = games.length;
    const k = sum((x) => x.k), d = sum((x) => x.d), a = sum((x) => x.a);
    stats.push(
      { label: "K/D", value: (k / Math.max(1, d)).toFixed(2) },
      { label: "KDA", value: ((k + a) / Math.max(1, d)).toFixed(2) },
      { label: "Ø K / D / A", value: [k, d, a].map((v) => +(v / n).toFixed(1)).join(" / ") },
      { label: "Ø Schaden", value: Math.round(sum((x) => x.dmg) / n).toLocaleString("de-DE") },
      { label: "CS / Min", value: (sum((x) => x.cs) / sum((x) => x.min)).toFixed(1) },
      { label: `Winrate (letzte ${n})`, value: `${Math.round((games.filter((x) => x.win).length / n) * 100)} %` }
    );

    const byChamp = {};
    for (const x of games) (byChamp[x.champ] ||= []).push(x);
    g.champions = Object.entries(byChamp)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([name, list]) => {
        const kk = list.reduce((s, x) => s + x.k + x.a, 0);
        const dd = list.reduce((s, x) => s + x.d, 0);
        return {
          name,
          games: list.length,
          winrate: Math.round((list.filter((x) => x.win).length / list.length) * 100),
          kda: (kk / Math.max(1, dd)).toFixed(2),
          img: `https://ddragon.leagueoflegends.com/cdn/${ddVer}/img/champion/${name}.png`,
        };
      });
    g.statsNote = `Durchschnitt aus den letzten ${n} Ranked-Spielen`;
  }
  g.stats = stats;
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

  // Level, aktuelle Legende und Gesamtwerte.
  // Achtung: Die API kennt nur Werte von Trackern, die auf einem Banner ausgerüstet sind.
  const gl = res.global || {};
  g.level = gl.level ?? g.level;
  // Prestige (Apex setzt das Level nach 500 zurück). Die API darf den Wert nur erhöhen –
  // ein von Hand eingetragener, höherer Prestige bleibt stehen (die API zählt evtl. anders).
  const apiPrestige = Number(gl.levelPrestige);
  if (Number.isFinite(apiPrestige) && apiPrestige > (Number(g.prestige) || 0)) g.prestige = apiPrestige;
  const legend = res.legends?.selected;
  g.avatar = legend?.ImgAssets?.icon || g.avatar || "";

  const num = (v) => {
    if (typeof v === "number") return v;
    const s = String(v ?? "").replace(/[^\d.-]/g, "");
    return s === "" ? NaN : Number(s); // fehlender Wert ≠ 0
  };
  const fmt = (v) =>
    !Number.isInteger(v) ? v.toFixed(2)
    : v >= 100000 ? new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 2 }).format(v)
    : v.toLocaleString("de-DE");
  const stats = [];
  if (legend?.LegendName) stats.push({ label: "Legende", value: legend.LegendName });

  // "total" enthält z. B. { kills: {name, value}, damage: {...}, kd: {value: "-1"} }
  const wanted = [
    ["career_kills", "Karriere-Kills"],
    ["career_wins", "Karriere-Siege"],
    ["kills", "Kills"],
    ["damage", "Schaden"],
    ["kd", "K/D"],
    ["wins", "Siege"],
    ["games_played", "Spiele"],
    ["headshots", "Headshots"],
  ];
  const total = res.total || {};
  for (const [key, label] of wanted) {
    const v = num(total[key]?.value);
    if (Number.isFinite(v) && v >= 0) stats.push({ label, value: fmt(v) });
  }
  // Ø Schaden nur, wenn Schaden und Spiele bekannt sind
  const dmg = num(total.damage?.value), gp = num(total.games_played?.value);
  if (dmg > 0 && gp > 0) stats.push({ label: "Ø Schaden", value: Math.round(dmg / gp).toLocaleString("de-DE") });

  g.stats = stats;
  g.statsNote = "Gesamtwerte laut Banner-Trackern";
  console.log(`Apex: Level ${g.level}, ${stats.length} Stats, total-Keys: ${Object.keys(total).join(", ") || "–"}`);
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
