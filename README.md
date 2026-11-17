# yJustusx – Gaming-Seite

Persönliche Webseite mit meinen aktuellen Rängen in **Rocket League**, **Apex Legends** und **League of Legends** und einem „Über mich“-Teil.

## Dateien

| Datei | Wofür |
|---|---|
| `data/profile.json` | Name, Text über mich, Fakten, Social-Links (`"avatar": "bild.png"` für ein Profilbild) |
| `data/ranks.json` | Ränge. Live-Werte werden automatisch überschrieben, manuelle Werte (Rocket League) hier eintragen |
| `scripts/fetch-ranks.mjs` | Holt die Live-Ränge (läuft in der GitHub Action) |
| `.github/workflows/deploy.yml` | Aktualisiert die Ränge stündlich und veröffentlicht die Seite |

## Einrichtung (einmalig)

1. **GitHub Pages aktivieren:** Repo → *Settings* → *Pages* → *Source*: **GitHub Actions**.
2. **API-Keys als Secrets hinterlegen:** Repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*
   - `RIOT_API_KEY` – von <https://developer.riotgames.com> (für LoL).
     Der Development-Key läuft alle 24 h ab. Für Dauerbetrieb dort ein **Personal API Key** beantragen (kostenlos).
   - `APEX_API_KEY` – kostenlos von <https://portal.apexlegendsapi.com> (für Apex).
3. Code auf den Branch `main` bringen → die Seite ist dann unter `https://yjustsux.github.io/me/` erreichbar.

Ohne Keys funktioniert die Seite trotzdem, dann werden einfach die Werte aus `data/ranks.json` angezeigt.

## Rocket League

Für Rocket League gibt es keine öffentliche API (tracker.gg gibt RL-Daten nicht frei).
Den Rang daher in `data/ranks.json` beim Eintrag `rocketleague` von Hand ändern (`rank`, `division`, `points`).

## Lokal ansehen

```bash
python3 -m http.server 8000
# → http://localhost:8000
```
