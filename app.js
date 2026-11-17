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
    el("span", { class: "peak-label" }, "🏆 Peak"),
    el("span", { class: "peak-rank" }, text),
    note ? el("span", { class: "peak-note" }, note) : null
  );
}

function gameCard(g) {
  const rankText = [g.rank, g.division].filter(Boolean).join(" ");
  const icon = el("div", { class: "rank-icon" + (g.rankImg ? " has-img" : "") });
  if (g.rankImg) icon.append(el("img", { src: g.rankImg, alt: rankText, loading: "lazy" }));
  else icon.textContent = (g.rank || "?").charAt(0).toUpperCase();

  return el("article", { class: "card", style: `--tier:${tierColor(g.rank)}` },
    el("div", { class: "card-top" },
      el("div", {},
        el("h3", {}, g.name),
        el("div", { class: "account" }, `${g.account} · ${g.platform}`)
      ),
      el("span", { class: "badge" + (g.source === "live" ? " live" : "") }, g.source === "live" ? "Live" : "Manuell")
    ),
    el("div", { class: "rank" },
      icon,
      el("div", {},
        el("div", { class: "rank-name" }, rankText || "Unranked"),
        g.points !== "" && g.points != null ? el("div", { class: "rank-points" }, `${g.points} ${g.pointsLabel}`) : null,
        el("div", { class: "playlist" }, g.playlist)
      )
    ),
    g.extra ? el("div", { class: "extra" }, g.extra) : null,
    peakRow(g),
    el("a", { class: "more", href: g.profileUrl, target: "_blank", rel: "noopener" }, "Volles Profil ansehen →")
  );
}

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
    games.replaceChildren(...r.games.map(gameCard));
    if (r.updated) {
      const d = new Date(r.updated);
      document.getElementById("updated").textContent =
        "Stand: " + d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
    }
  } catch (e) {
    games.replaceChildren(el("p", { class: "muted" }, "Ränge konnten nicht geladen werden."));
  }
})();
