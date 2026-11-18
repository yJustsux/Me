// Farben pro Rang-Stufe (passt für LoL, Apex und Rocket League)
const TIER_COLORS = [
  [/iron|eisen/i, "#7a6a62"],
  [/bronze/i, "#c27a45"],
  [/silver|silber/i, "#b8c2cc"],
  [/gold/i, "#f5c542"],
  [/platinum|platin/i, "#3fc7b6"],
  [/emerald|smaragd/i, "#2ecc71"],
  [/diamond|diamant/i, "#5aa9ff"],
  [/grandmaster/i, "#e8454a"],
  [/master|meister/i, "#b16cff"],
  [/challenger|predator/i, "#ff4d6d"],
  [/grand champion|supersonic|ssl/i, "#ff6bd6"],
  [/champion/i, "#a259ff"],
  [/rookie/i, "#9aa3b5"],
];

const tierColor = (rank) => (TIER_COLORS.find(([re]) => re.test(rank || "")) || [, "var(--accent)"])[1];

const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "style") n.style.cssText = v;
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== "") n.append(c);
  return n;
};

function peakRow(g) {
  const p = g.peak;
  if (!p || !p.rank) return null;
  const text = [p.rank, p.division].filter(Boolean).join(" ");
  const pts = p.points !== "" && p.points != null ? `${p.points} ${g.pointsLabel}` : "";
  const note = [pts, p.note].filter(Boolean).join(" · ");
  return el("div", { class: "peak", style: `--peak:${tierColor(p.rank)}` },
    el("span", { class: "peak-label" }, "🏆 All-Time Peak"),
    el("span", { class: "peak-rank" }, text),
    note ? el("span", { class: "peak-note" }, note) : null
  );
}

function statsGrid(g) {
  const stats = (g.stats || []).filter((s) => s && s.label && s.value !== "" && s.value != null);
  if (!stats.length) return null;
  return el("div", { class: "stats" },
    el("div", { class: "stats-grid" },
      stats.map((s) => el("div", { class: "stat" },
        el("span", { class: "stat-value" }, String(s.value)),
        el("span", { class: "stat-label" }, s.label)
      ))
    ),
    g.statsNote ? el("div", { class: "stats-note" }, g.statsNote) : null
  );
}

function championList(g) {
  if (!g.champions || !g.champions.length) return null;
  return el("div", { class: "champs" },
    el("div", { class: "champs-title" }, "Meistgespielt"),
    g.champions.map((c) => el("div", { class: "champ" },
      el("img", { src: c.img, alt: "", loading: "lazy", width: "32", height: "32", onerror: "this.style.visibility='hidden'" }),
      el("span", { class: "champ-name" }, c.name),
      el("span", { class: "champ-meta" }, `${c.games} ${c.games === 1 ? "Spiel" : "Spiele"} · ${c.winrate} % · ${c.kda} KDA`)
    ))
  );
}

function gameCard(g) {
  const rankText = [g.rank, g.division].filter(Boolean).join(" ");
  const icon = el("div", { class: "rank-icon" + (g.rankImg ? " has-img" : "") });
  const letter = (g.rank || "?").charAt(0).toUpperCase();
  if (g.rankImg) {
    const img = el("img", { src: g.rankImg, alt: rankText, loading: "lazy" });
    // Bild lädt nicht → Buchstabe statt kaputtem Bild
    img.addEventListener("error", () => { icon.className = "rank-icon"; icon.textContent = letter; });
    icon.append(img);
  } else icon.textContent = letter;

  // Kopf (Name, Account, Level) und Stats – stehen neben dem Rang-Feld
  const head = el("div", { class: "card-top" },
    el("div", {},
      el("h3", {}, g.name),
      el("div", { class: "account" }, `${g.account} · ${g.platform}`)
    ),
    g.level != null && g.level !== "" ? el("span", { class: "level" }, `Lvl ${g.level}`) : null
  );
  const body = el("div", { class: "card-body" },
    statsGrid(g),
    championList(g),
    el("a", { class: "more", href: g.profileUrl, target: "_blank", rel: "noopener" }, "Volles Profil ansehen →")
  );

  // Großes Rang-Feld
  const rankPanel = el("div", { class: "rank-panel" },
    el("a", { class: "rank", href: g.profileUrl, target: "_blank", rel: "noopener", title: `${g.name}-Profil auf dem Tracker öffnen` },
      icon,
      el("div", { class: "rank-name" }, rankText || "Unranked"),
      g.points !== "" && g.points != null ? el("div", { class: "rank-points" }, `${g.points} ${g.pointsLabel}`) : null,
      el("div", { class: "playlist" }, g.playlist)
    ),
    peakRow(g)
  );

  return el("article", { class: "card", style: `--tier:${tierColor(g.rank)}` }, head, body, rankPanel);
}

// Reihenfolge auf der Seite (wie in der Skizze)
const ORDER = ["lol", "apex", "rocketleague"];
const byOrder = (a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99);

async function load(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(path);
  return res.json();
}

(async () => {
  try {
    const p = await load("data/profile.json");
    document.title = p.name;
    document.getElementById("name").textContent = p.name;
    document.getElementById("tagline").textContent = p.tagline;
    const av = document.getElementById("avatar");
    if (p.avatar) { av.style.backgroundImage = `url("${p.avatar}")`; av.textContent = ""; }
    else av.textContent = p.name.charAt(0).toUpperCase();
    document.getElementById("socials").replaceChildren(
      ...p.socials.filter((s) => s.url).map((s) => el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.name))
    );
    document.getElementById("about-text").replaceChildren(...p.about.map((t) => el("p", {}, t)));
    document.getElementById("facts").replaceChildren(
      ...p.facts.map((f) => el("div", {}, el("dt", {}, f.label), el("dd", {}, f.value)))
    );
  } catch (e) { console.error(e); }

  const games = document.getElementById("games");
  try {
    const r = await load("data/ranks.json");
    games.replaceChildren(...[...r.games].sort(byOrder).map(gameCard));
    if (r.updated) {
      const d = new Date(r.updated);
      document.getElementById("updated").textContent =
        "Stand: " + d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
    }
  } catch (e) {
    games.replaceChildren(el("p", { class: "muted" }, "Ränge konnten nicht geladen werden."));
  }
})();
