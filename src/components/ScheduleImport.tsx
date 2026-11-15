import { useRef, useState } from "react";
import { parseSchedulePdf } from "@/lib/parseSchedulePdf";
import { useServerFn } from "@tanstack/react-start";
import { toStoredImport, type ImportInfo } from "@/lib/scheduleStore";
import { saveScheduleImport, removeScheduleImport } from "@/lib/gate.functions";

interface Result { name: string; ok: boolean; message: string }

export function ScheduleImport({ imports, doctors, onChanged }: { imports: ImportInfo[]; doctors: Record<string, string>; onChanged: () => void }) {
  const saveFn = useServerFn(saveScheduleImport);
  const removeFn = useServerFn(removeScheduleImport);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf");
    const out: Result[] = files
      .filter(f => !pdfs.includes(f))
      .map(f => ({ name: f.name, ok: false, message: "Keine PDF-Datei" }));
    setBusy(true);
    for (const file of pdfs) {
      try {
        const parsed = await parseSchedulePdf(await file.arrayBuffer(), doctors);
        if (!parsed.entries.length) throw new Error("Keine Dienste erkannt");
        await saveFn({ data: toStoredImport(parsed) });
        const neu = parsed.unknownDoctors.length ? ` · neu: ${parsed.unknownDoctors.join(", ")}` : "";
        out.push({
          name: file.name,
          ok: true,
          message: `${parsed.monthLabel}: ${parsed.entries.length} Einträge für alle gespeichert${neu}`,
        });
      } catch (err) {
        out.push({ name: file.name, ok: false, message: err instanceof Error ? err.message : "Datei konnte nicht gelesen werden" });
      }
    }
    setBusy(false);
    setResults(out);
    onChanged();
  };

  return (
    <section className="import-zone-wrap">
      <div
        className={`import-zone ${over ? "is-over" : ""} ${busy ? "is-busy" : ""}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          void handleFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={e => {
            void handleFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <strong>{busy ? "Plan wird gelesen …" : "Dienstplan hier ablegen"}</strong>
        <span>PDF hierher ziehen oder klicken · ein Monat pro Datei · ersetzt den jeweiligen Monat · sofort für alle sichtbar</span>
      </div>

      {results.length > 0 && (
        <ul className="import-results">
          {results.map(r => (
            <li key={r.name} className={r.ok ? "is-ok" : "is-err"}>
              <span className="ir-name">{r.name}</span>
              <span>{r.message}</span>
            </li>
          ))}
        </ul>
      )}

      {imports.length > 0 && (
        <ul className="import-list">
          {imports.map(i => (
            <li key={i.key}>
              <span>{i.monthLabel} · {i.count} Einträge · aktualisiert {new Date(i.importedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
              <button
                onClick={async () => { await removeFn({ data: { key: i.key } }); setResults([]); onChanged(); }}
                className="btn-ghost btn-sm"
              >Entfernen</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
