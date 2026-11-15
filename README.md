# Dienstplan

Eine App für den ärztlichen Dienstplan einer Notaufnahme, mit drei Bereichen:

- **Aktuell**: Wer hat wann Dienst, wer kann einspringen (nach Einspringliste, Ruhezeiten geprüft), Tausch- und Ringtausch-Vorschläge bei Ausfall, KI-Assistent.
- **Planung**: Jede Person gibt ihre eigenen Wünsche ab und sieht fremde Wünsche nur als Anzahl. Planer sehen die Übersicht, exportieren das Planungspaket für den Dienstplan-Generator und verabschieden Entwürfe.
- **Einstellungen**: Personal, Konten, Seitenpasswort, Sicherung.

## Aufbau

| Teil | Ort | Läuft auf |
| --- | --- | --- |
| Oberfläche (React, Vite) | `src/` | GitHub Pages |
| Serverlogik (eine Funktion) | `server/` | Supabase Edge Function `dienstplan` |
| Daten | Tabellen `dp_*`, siehe `db/schema.sql` | Supabase (Postgres) |

In diesem Repository liegt nur Code. Namen, Pläne, Wünsche und Passwörter liegen ausschließlich in der Datenbank.
Jeder Push auf `main` prüft, baut und liefert beides aus (`.github/workflows/deploy.yml`).

## Einmalige Einrichtung

1. `db/schema.sql` im Supabase-Projekt ausführen.
2. GitHub: Settings → Pages → Source „GitHub Actions".
3. GitHub: Settings → Secrets and variables → Actions → `SUPABASE_ACCESS_TOKEN` (aus dem Supabase-Konto, Access Tokens).
4. Supabase: Edge Functions → Secrets → `OPENROUTER_API_KEY` für den KI-Assistenten.
   Optional `DP_ALLOWED_ORIGINS` (kommagetrennt), wenn die Seite unter einer eigenen Adresse läuft.

## Entwickeln

```
bun install
bun test          # Logik, Server und die ganze App im simulierten Browser
bun run typecheck
bun run dev
```
