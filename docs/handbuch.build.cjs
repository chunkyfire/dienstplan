// Baut das Handbuch als HTML (docs/handbuch.html). Das PDF entsteht daraus mit Chrome:
//   node docs/handbuch.build.cjs
//   google-chrome --headless=new --no-pdf-header-footer --print-to-pdf=public/Dienstplan_Handbuch.pdf docs/handbuch.html
// Keine echten Namen, keine Passwörter: das PDF ist öffentlich erreichbar.
const fs = require("fs");
const path = require("path");

const A = "#FF4D2E"; // Akzent
const T = "#FFE3DB"; // Akzent hell

/* ---------- Piktogramme (24er Raster, eigene Zeichnungen) ---------- */
const ICONS = {
  link: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
  key: `<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>`,
  ticket: `<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v2M14 11v2M14 16v2"/>`,
  eye: `<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  eyeoff: `<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 3l16 18"/>`,
  pen: `<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>`,
  cal: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  phone: `<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>`,
  check: `<path d="M4 12.5l5 5L20 6.5"/>`,
  cross: `<path d="M5 5l14 14M19 5L5 19"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  moon: `<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>`,
  down: `<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>`,
  up: `<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>`,
  lock: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  users: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5a5 5 0 0 1 4.5 5"/>`,
  spark: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>`,
  gear: `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>`,
  tap: `<path d="M9 11V5a2 2 0 0 1 4 0v6"/><path d="M13 10a2 2 0 0 1 4 0v2a2 2 0 0 1 3 1.5V16a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L5 15a1.7 1.7 0 0 1 2.7-2L9 14"/>`,
  shield: `<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>`,
  box: `<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>`,
  cog2: `<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>`,
  stamp: `<path d="M9 13V9a3 3 0 1 1 6 0v4"/><rect x="5" y="13" width="14" height="4" rx="1"/><path d="M4 21h16"/>`,
  sofa: `<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 12a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v6H3z"/><path d="M6 18v2M18 18v2"/>`,
  palm: `<path d="M12 21c0-5 .5-8 2-11"/><path d="M14 10c-3-3-7-2-9 0 3-1 6 0 9 0zM14 10c0-4 3-6 6-6-2 1-4 3-6 6zM14 10c3-1 6 0 7 3-2-2-4-3-7-3zM14 10c-2-3-1-6 1-8 0 3 0 5-1 8z"/>`,
  book: `<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2z"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  save: `<path d="M5 3h11l4 4v14H4V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M7 21v-7h10v7"/>`,
};
const ic = (n, size = 22, extra = "") =>
  `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24">${ICONS[n]}</svg>`;

/* ---------- Figur (eigene Zeichnung: Kittel-Figur mit Haube) ---------- */
const DEFS = `
<svg width="0" height="0" style="position:absolute">
 <defs>
  <symbol id="fig" viewBox="0 0 64 100">
    <path d="M24 70v22M40 70v22M20 93h8M36 93h8" class="ln"/>
    <path d="M15 47L8 64M49 47l7 17" class="ln"/>
    <path d="M14 70V45q0-10 11-10h14q11 0 11 10v25z" class="ln" style="fill:var(--f,#fff)"/>
    <path d="M26 35l6 8 6-8" class="ln" style="fill:none"/>
    <circle cx="32" cy="18" r="12.5" class="ln" style="fill:#fff"/>
    <path d="M19.8 15C21 3.5 43 3.5 44.2 15z" style="fill:#111"/>
    <path d="M27 21.5v.1M37 21.5v.1" class="ln"/>
    <path d="M28 26q4 3 8 0" class="ln" style="fill:none"/>
  </symbol>
  <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l8 4-8 4" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>
  <marker id="aha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l8 4-8 4" fill="none" stroke="${A}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>
 </defs>
</svg>`;
const fig = (x, y, h, fill) =>
  `<use href="#fig" x="${x}" y="${y}" width="${h * 0.64}" height="${h}" ${fill ? `style="--f:${fill}"` : ""}/>`;

/* ---------- Bausteine ---------- */
let pageNo = 0;
const page = (kicker, title, body, cls = "") => {
  pageNo++;
  return `<section class="page ${cls}">
  <header><div class="kick">${kicker}</div><h1>${title}</h1></header>
  <main>${body}</main>
  <footer><span class="pn">${pageNo}</span><span class="wm">DIENSTPLAN</span></footer>
</section>`;
};
const step = (n, title, text, art = "") =>
  `<div class="step"><div class="num">${n}</div><div class="art">${art}</div><h3>${title}</h3><p>${text}</p></div>`;
const note = (icon, html, cls = "") => `<div class="note ${cls}">${ic(icon, 22)}<div>${html}</div></div>`;
const co = n => `<span class="co">${n}</span>`;
const dot = c => `<i class="dot" style="background:${c}"></i>`;
const LV = { ca: "#111", oa: A, fa: "#8A8A8A", aa: "#fff" };

/* Mini-Bildschirm */
const screen = inner => `<div class="scr"><div class="bar"><i></i><i></i><i></i></div><div class="scrb">${inner}</div></div>`;
const tabs = on => `<div class="tabs">${["Aktuell", "Planung", "Einstellungen"].map((t, i) => `<span class="${i === on ? "on" : ""}">${t}</span>`).join("")}</div>`;

/* Wochenansicht als Drahtmodell */
const week = () => {
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const rows = [["Notarzt", 1], ["Früh", 3], ["Zwischen", 1], ["Spät", 2], ["Nacht", 1]];
  const lv = ["oa", "fa", "aa", "aa", "oa", "fa", "aa"];
  let h = `<div class="wk"><div class="wkh"></div>${days.map((d, i) => `<div class="wkh ${i > 4 ? "we" : ""} ${i === 2 ? "today" : ""}">${d}</div>`).join("")}`;
  rows.forEach(([name, n], r) => {
    h += `<div class="wkl">${name}</div>`;
    for (let d = 0; d < 7; d++) {
      let c = "";
      for (let k = 0; k < n; k++) c += `<div class="nm">${dot(LV[lv[(r + d + k) % 7]])}<b style="width:${46 + ((r * 7 + d * 3 + k * 5) % 4) * 9}%"></b></div>`;
      h += `<div class="wkc ${d > 4 ? "we" : ""} ${r === 3 && d === 2 ? "hit" : ""}">${c}</div>`;
    }
  });
  h += `<div class="wkl free">Wer kann<br>einspringen?</div>`;
  for (let d = 0; d < 7; d++) {
    h += `<div class="wkc free ${d > 4 ? "we" : ""}"><div class="nm first">${dot(LV.oa)}<b style="width:60%"></b></div><div class="nm first">${dot(LV.aa)}<b style="width:48%"></b></div><div class="nm">${dot(LV.fa)}<b style="width:55%"></b></div></div>`;
  }
  return h + `</div>`;
};

/* ---------- Seiten ---------- */
const pages = [];

/* 1 Titel */
pages.push(`<section class="page cover">
  <div class="ctop"><div class="ctag">Anleitung</div><div class="ctag ghost">für alle im Team</div></div>
  <h1 class="ctitle">DIENST<br>PLAN</h1>
  <p class="csub">Selbst. Bestimmt. Arbeiten.</p>
  <svg class="cart" viewBox="0 0 520 330">
    <rect x="150" y="26" width="344" height="252" rx="14" class="ln" fill="#fff"/>
    <path d="M150 70h344" class="ln"/>
    ${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${205 + i * 42} 16v22" class="ln"/>`).join("")}
    ${(() => {
      let s = ""; const fill = { 3: A, 9: T, 10: T, 16: "#111", 19: A, 24: T, 29: "#111", 33: A };
      const tx = { 3: "F", 16: "N", 19: "S", 29: "N", 33: "X" };
      for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
        const k = r * 7 + c, x = 166 + c * 45, y = 84 + r * 37;
        s += `<rect x="${x}" y="${y}" width="37" height="29" rx="6" fill="${fill[k] || "#fff"}" stroke="#111" stroke-width="2"/>`;
        if (tx[k]) s += `<text x="${x + 18.5}" y="${y + 20.5}" text-anchor="middle" font-size="15" font-weight="800" fill="${fill[k] === "#111" || fill[k] === A ? "#fff" : "#111"}">${tx[k]}</text>`;
      }
      return s;
    })()}
    ${fig(22, 132, 190, T)}${fig(86, 176, 146)}
    <path d="M116 222l40-52" class="ln"/><path d="M150 176l10-12 6 5-10 12z" fill="${A}" class="ln"/>
    <path d="M10 322h500" class="ln"/>
  </svg>
  <div class="cfoot">
    <div class="pills"><span>Aktuell</span><span>Planung</span><span>Einstellungen</span></div>
    <div class="url">${ic("link", 18)} chunkyfire.github.io/dienstplan</div>
  </div>
</section>`);
pageNo = 1;

/* 2 Inhalt */
pages.push(page("Bevor du startest", "Was ist drin?", `
  <div class="parts">
    <div class="part"><span class="pid">A</span>${screen(tabs(0) + `<div class="mini wkm"></div>`)}<h3>Aktuell</h3><p>Der gültige Plan, Woche für Woche. Und: wer einspringen kann.</p><span class="qty">1×</span></div>
    <div class="part"><span class="pid">B</span>${screen(tabs(1) + `<div class="mini calm">${Array.from({ length: 21 }, (_, i) => `<i class="${[4, 9, 10].includes(i) ? "a" : i === 15 ? "k" : ""}"></i>`).join("")}</div>`)}<h3>Planung</h3><p>Deine Wünsche für die nächsten Monate. Nur du siehst sie.</p><span class="qty">1×</span></div>
    <div class="part"><span class="pid">C</span>${screen(tabs(2) + `<div class="mini setm"><i></i><i></i><i class="s"></i></div>`)}<h3>Einstellungen</h3><p>Dein Passwort. Für die Dienstplanung: Personal und Sicherung.</p><span class="qty">1×</span></div>
  </div>
  <h2>Du brauchst</h2>
  <div class="need">
    <div><div class="big">${ic("link", 40)}</div><b>Link</b><span>PC, Tablet oder Handy</span></div>
    <div><div class="big">${ic("key", 40)}</div><b>Seitenpasswort</b><span>für alle gleich, von der Dienstplanung</span></div>
    <div><div class="big">${ic("ticket", 40)}</div><b>Einmal-Code</b><span>nur für dich, gilt genau einmal</span></div>
  </div>
  <h2>Wofür – und wofür nicht</h2>
  <div class="yesno">
    <div class="yes">${ic("check", 26)}<span>Dienste, Wünsche, Einspringen, Tauschen</span></div>
    <div class="no">${ic("cross", 26)}<span>Patientendaten</span></div>
    <div class="no">${ic("cross", 26)}<span>Medizinische Entscheidungen</span></div>
  </div>
  <p class="fine">Die Anwendung dient nur der internen Organisation der Personaleinsatzplanung. Sie ist kein Medizinprodukt und hat keine medizinische Zweckbestimmung. Vorschläge für Ersatz und Tausch sind Hilfen für die Absprache im Team; verbindlich ist, was mit der Dienstplanung vereinbart wird.</p>
`));

/* 3 Zugang */
pages.push(page("Zugang", "Reinkommen", `
  <div class="lane">
    <div class="lh"><span class="tag">Stufe 1</span><h2>Ansehen</h2><span class="with">${ic("key", 18)} mit dem Seitenpasswort</span></div>
    <div class="steps">
      ${step(1, "Link öffnen", "Am besten als Lesezeichen speichern.", screen(`<div class="addr">${ic("link", 12)}<b></b></div>`))}
      ${step(2, "Seitenpasswort", "Eintippen, „Öffnen“.", screen(`<div class="form"><i class="in">● ● ● ● ●</i><i class="btn">Öffnen</i></div>`))}
      ${step(3, "Plan sehen", "Dein Gerät merkt sich das 30 Tage.", screen(tabs(0) + `<div class="mini wkm"></div>`))}
    </div>
  </div>
  <div class="lane acc">
    <div class="lh"><span class="tag">Stufe 2</span><h2>Wünschen</h2><span class="with">${ic("ticket", 18)} mit deinem eigenen Konto</span></div>
    <div class="steps">
      ${step(1, "Namen wählen", "Reiter „Planung“, dann dich in der Liste suchen.", screen(tabs(1) + `<div class="form"><i class="in sel">Name ▾</i></div>`))}
      ${step(2, "Konto einrichten", "Einmal-Code eingeben, eigenes Passwort ausdenken (mind. 8 Zeichen).", screen(`<div class="form"><i class="in code">K 7 X 2 …</i><i class="in">● ● ● ● ● ● ● ●</i><i class="btn a">Konto einrichten</i></div>`))}
      ${step(3, "Fertig", "Ab jetzt reichen Name und Passwort. Keine E-Mail nötig.", screen(tabs(1) + `<div class="mini calm">${Array.from({ length: 21 }, (_, i) => `<i class="${[4, 9, 10].includes(i) ? "a" : ""}"></i>`).join("")}</div>`))}
    </div>
  </div>
  <div class="row2">
    ${note("lock", "<b>5× falsch getippt?</b> 10 Minuten Pause, dann geht es weiter.")}
    ${note("ticket", "<b>Passwort vergessen?</b> Die Dienstplanung gibt dir einen neuen Einmal-Code.")}
  </div>
`));

/* 4 Aktuell */
pages.push(page("Bereich A", "Aktuell", `
  <div class="anno">
    ${screen(tabs(0) + `<div class="wktop"><span class="nav">‹</span><span class="nav">Heute</span><span class="nav">›</span><span class="sp"></span><span class="nav f">Alle</span><span class="nav f">${dot(LV.oa)}</span><span class="nav f">${dot(LV.fa)}</span><span class="nav f">${dot(LV.aa)}</span></div>` + week())}
    <span class="co p1">1</span><span class="co p2">2</span><span class="co p3">3</span><span class="co p4">4</span><span class="co p5">5</span><span class="co p6">6</span>
  </div>
  <div class="legend">
    <div>${co(1)}<p><b>Woche wechseln.</b> Pfeile, oder zurück mit „Heute“.</p></div>
    <div>${co(2)}<p><b>Eine Ebene einblenden.</b> Alle, Oberarzt, Facharzt, Assistenzarzt.</p></div>
    <div>${co(3)}<p><b>Dienste von oben nach unten:</b> Notarzt, Früh, Zwischen, Spät, Nacht.</p></div>
    <div>${co(4)}<p><b>Punkt = Ebene.</b> ${dot(LV.ca)} Chefarzt ${dot(LV.oa)} Oberarzt ${dot(LV.fa)} Facharzt ${dot(LV.aa)} Assistenzarzt</p></div>
    <div>${co(5)}<p><b>Dienst antippen:</b> „Fällt aus? Lösungen anzeigen“.</p></div>
    <div>${co(6)}<p><b>Wer kann einspringen?</b> Die ersten zwei sind laut Einspringliste als Nächste dran.</p></div>
  </div>
  <h2>Wer frei hat, bekommt ein Etikett</h2>
  <div class="chips">
    <div class="chip ok">${ic("check", 24)}<b>kann einspringen</b><span>frei, genug Ruhezeit</span></div>
    <div class="chip">${ic("clock", 24)}<b>eingeschränkt</b><span>z. B. nach Spät erst ab Mittag</span></div>
    <div class="chip">${ic("sofa", 24)}<b>Freiwunsch (X)</b><span>wollte den Tag frei haben</span></div>
    <div class="chip off">${ic("cross", 24)}<b>nicht einsetzbar</b><span>Ruhezeit, Urlaub, krank …</span></div>
  </div>
  <h2>Unter dem Plan</h2>
  <div class="row3 flat">
    ${note("users", "<b>Einspringliste.</b> Aufklappen, Reihenfolge ansehen und ändern.")}
    ${note("spark", "<b>Ausfall-Assistent.</b> Frage stellen, er bezieht sich auf die gezeigte Woche.")}
    ${note("clock", "<b>Legende &amp; Schichtzeiten.</b> Alle Kürzel mit Uhrzeiten.")}
  </div>
`));

/* 5 Ausfall */
const ppl = (x, y, fill, lab) => `${fig(x, y, 62, fill)}${lab ? `<text x="${x + 20}" y="${y + 78}" text-anchor="middle" class="sl">${lab}</text>` : ""}`;
const slot = (x, y, t, on) => `<rect x="${x}" y="${y}" width="46" height="30" rx="7" fill="${on ? A : "#fff"}" class="ln"/><text x="${x + 23}" y="${y + 21}" text-anchor="middle" font-size="14" font-weight="800" fill="${on ? "#fff" : "#111"}">${t}</text>`;
pages.push(page("Bereich A", "Jemand fällt aus", `
  <div class="steps three">
    ${step(1, "Dienst antippen", "Im Plan auf den Dienst, der ausfällt.", `<svg viewBox="0 0 150 90"><rect x="18" y="14" width="114" height="44" rx="9" fill="${T}" class="ln"/><circle cx="36" cy="36" r="5" fill="${A}" class="ln"/><path d="M48 36h62" class="ln" stroke-width="6"/><g transform="translate(92 34) scale(1.9)" class="icg">${ICONS.tap}</g></svg>`)}
    ${step(2, "Lösungen lesen", "Sortiert von einfach nach aufwendig.", `<svg viewBox="0 0 150 90">${[0, 1, 2].map(i => `<rect x="24" y="${10 + i * 25}" width="102" height="19" rx="6" fill="${i === 0 ? T : "#fff"}" class="ln"/><text x="36" y="${24 + i * 25}" font-size="11" font-weight="800">${i + 1}</text><path d="M50 ${19.5 + i * 25}h${62 - i * 14}" class="ln"/>`).join("")}</svg>`)}
    ${step(3, "Anrufen", "Bei jeder Lösung steht, wen.", `<svg viewBox="0 0 150 90">${fig(30, 8, 76, T)}<g transform="translate(84 20) scale(2)" class="icg">${ICONS.phone}</g></svg>`)}
  </div>
  <h2>Vier Arten von Lösung</h2>
  <div class="sol">
    <div><span class="sn">1</span><h3>Direkter Ersatz</h3>
      <svg viewBox="0 0 230 110">${ppl(14, 8, T, "frei")}${slot(150, 22, "S", 1)}<path d="M64 38h78" class="ln" marker-end="url(#ah)"/></svg>
      <p>Eine Person anrufen.</p></div>
    <div><span class="sn">2</span><h3>Tausch am selben Tag</h3>
      <svg viewBox="0 0 230 110">${ppl(14, 8, T, "frei")}${slot(92, 6, "F")}${slot(170, 6, "S", 1)}${ppl(96, 44, "", "")}<path d="M140 21h24" class="ln" marker-end="url(#ah)"/><path d="M58 24l28-4" class="ln" marker-end="url(#ah)"/></svg>
      <p>Jemand wechselt die Schicht, ein Freier füllt nach.</p></div>
    <div><span class="sn">3</span><h3>Tausch zwischen zwei Tagen</h3>
      <svg viewBox="0 0 230 110"><text x="66" y="14" text-anchor="middle" class="sl">Mi</text><text x="166" y="14" text-anchor="middle" class="sl">Do</text><rect x="20" y="20" width="92" height="82" rx="10" class="ln" fill="#fff"/><rect x="120" y="20" width="92" height="82" rx="10" class="ln" fill="#fff"/>${slot(43, 30, "S", 1)}${slot(143, 30, "F")}${fig(48, 62, 36, T)}${fig(148, 62, 36)}<path d="M78 82h64" class="ln" marker-end="url(#ah)" marker-start="url(#ah)"/></svg>
      <p>Der Ersatz gibt dafür einen Dienst am Nachbartag ab.</p></div>
    <div><span class="sn">4</span><h3>Ringtausch</h3>
      <svg viewBox="0 0 230 110">${fig(98, 0, 46, T)}${fig(36, 58, 46)}${fig(160, 58, 46)}<path d="M96 30Q64 36 58 56" class="ln" marker-end="url(#ah)" fill="none"/><path d="M76 92h78" class="ln" marker-end="url(#ah)"/><path d="M178 56Q172 36 136 30" class="ln" marker-end="url(#ah)" fill="none"/></svg>
      <p>Drei Personen verschieben sich.</p></div>
  </div>
  <div class="row2">
    ${note("shield", "<b>Nur was erlaubt ist.</b> Jede Lösung hält 11 Stunden Ruhezeit ein und höchstens 24 Stunden am Stück. Knappe Ruhezeiten stehen als Warnung dabei.")}
    ${note("spark", "<b>Lieber fragen?</b> Unter dem Plan sitzt der Ausfall-Assistent. Frag in normaler Sprache, er nutzt dieselbe Prüfung und erfindet nichts.", "acc")}
  </div>
`));

/* 6 Einspringliste */
pages.push(page("Bereich A", "Die Einspringliste", `
  <p class="lead">Jede Ebene hat ihre eigene Schlange. Vorne steht, wer als Nächstes gefragt wird.</p>
  <svg class="queue" viewBox="0 0 660 250">
    <text x="64" y="26" text-anchor="middle" class="sl b">als Nächste dran</text>
    <path d="M22 34h84" class="ln" stroke="${A}"/>
    ${[0, 1, 2, 3, 4, 5].map(i => `${fig(22 + i * 96, 46, 120, i < 2 ? A : i === 5 ? T : "")}<circle cx="${60 + i * 96}" cy="186" r="13" fill="${i < 2 ? "#111" : "#fff"}" class="ln"/><text x="${60 + i * 96}" y="191.5" text-anchor="middle" font-size="14" font-weight="800" fill="${i < 2 ? "#fff" : "#111"}">${i + 1}</text>`).join("")}
    <path d="M60 212Q60 244 180 244H470Q540 244 540 214" fill="none" stroke="${A}" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="2 9" marker-end="url(#aha)"/>
    <text x="300" y="234" text-anchor="middle" class="sl b" fill="${A}">eingesprungen → ans Ende</text>
    <path d="M610 60v110" class="ln" stroke-dasharray="2 8"/>
  </svg>
  <div class="lv3"><span>${dot(LV.oa)} Oberarzt</span><span>${dot(LV.fa)} Facharzt</span><span>${dot(LV.aa)} Assistenzarzt</span><em>drei Listen, eine pro Ebene</em></div>
  <h2>Einspringen vermerken</h2>
  <div class="steps three">
    ${step(1, "Namen antippen", "Am Tag, unter „Wer kann einspringen?“.", `<svg viewBox="0 0 150 80"><rect x="18" y="12" width="114" height="22" rx="7" fill="${T}" class="ln"/><circle cx="32" cy="23" r="4.5" fill="${A}" class="ln"/><path d="M44 23h50" class="ln" stroke-width="5"/><rect x="18" y="40" width="114" height="22" rx="7" fill="#fff" class="ln"/><path d="M44 51h38" class="ln" stroke-width="5"/><g transform="translate(96 22) scale(1.7)" class="icg">${ICONS.tap}</g></svg>`)}
    ${step(2, "Bestätigen", "„Ja, ans Ende der Liste“.", `<svg viewBox="0 0 150 80"><rect x="14" y="10" width="122" height="60" rx="10" fill="#fff" class="ln"/><path d="M28 28h70" class="ln" stroke-width="5"/><rect x="26" y="42" width="60" height="18" rx="9" fill="${A}" class="ln"/><text x="56" y="55" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">Ja</text><rect x="92" y="42" width="34" height="18" rx="9" fill="#fff" class="ln"/></svg>`)}
    ${step(3, "Alles rechnet neu", "Sofort, für alle Tage und für alle.", `<svg viewBox="0 0 150 80">${[0, 1, 2, 3].map(i => `<rect x="${16 + i * 31}" y="14" width="25" height="52" rx="7" fill="#fff" class="ln"/><circle cx="${28.5 + i * 31}" cy="27" r="4" fill="${i % 2 ? T : A}" class="ln"/><circle cx="${28.5 + i * 31}" cy="40" r="4" fill="${i % 2 ? A : T}" class="ln"/><circle cx="${28.5 + i * 31}" cy="53" r="4" fill="#fff" class="ln"/>`).join("")}</svg>`)}
  </div>
  <div class="row2">
    ${note("pen", "<b>Reihenfolge von Hand ändern:</b> unter dem Plan „Einspringliste“ aufklappen, mit den Pfeilen verschieben. Geht mit dem Seitenpasswort.")}
    ${note("save", "<b>Nichts geht verloren.</b> Jedes Einspringen wird gespeichert und zählt bei der Planung der nächsten Monate mit.", "acc")}
  </div>
`));

/* 7 Wünsche */
const tile = (c, l, icon, cls = "") => `<div class="tile ${cls}"><b>${c}</b><span>${l}</span>${ic(icon, 20)}</div>`;
pages.push(page("Bereich B", "Wünsche abgeben", `
  <div class="steps three">
    ${step(1, "Monat wählen", "Vorgeschlagen ist der nächste Monat.", `<svg viewBox="0 0 150 80"><rect x="40" y="26" width="70" height="28" rx="14" fill="#fff" class="ln"/><text x="75" y="45" text-anchor="middle" font-size="12" font-weight="800">Monat</text><path d="M26 40l-10 0M16 40l6-6M16 40l6 6" class="ln"/><path d="M124 40h10M134 40l-6-6M134 40l-6 6" class="ln"/></svg>`)}
    ${step(2, "Stift wählen", "Oben in der Leiste: welcher Wunsch?", `<svg viewBox="0 0 150 80">${["X", "U", "FB", "F", "S"].map((t, i) => `<rect x="${8 + i * 27.5}" y="24" width="23" height="26" rx="7" fill="${i === 0 ? A : "#fff"}" class="ln"/><text x="${19.5 + i * 27.5}" y="42" text-anchor="middle" font-size="10.5" font-weight="800" fill="${i === 0 ? "#fff" : "#111"}">${t}</text>`).join("")}<path d="M19 58v10" class="ln" marker-start="url(#ah)"/></svg>`)}
    ${step(3, "Tage antippen", "Speichert sofort. Nochmal antippen nimmt den Wunsch zurück.", `<svg viewBox="0 0 150 80">${Array.from({ length: 10 }, (_, i) => { const on = [1, 2, 7].includes(i); return `<rect x="${12 + (i % 5) * 26}" y="${12 + Math.floor(i / 5) * 28}" width="21" height="22" rx="6" fill="${on ? A : "#fff"}" class="ln"/>${on ? `<text x="${22.5 + (i % 5) * 26}" y="${27.5 + Math.floor(i / 5) * 28}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">X</text>` : ""}`; }).join("")}<g transform="translate(96 40) scale(1.6)" class="icg">${ICONS.tap}</g></svg>`)}
  </div>
  <h2>Deine neun Stifte</h2>
  <div class="tiles">
    <div class="tg"><em>Ich bin nicht da</em><div>${tile("X", "Wunschfrei", "sofa", "a")}${tile("U", "Urlaub", "palm", "a")}${tile("FB", "Fortbildung", "book", "a")}</div></div>
    <div class="tg"><em>Diesen Dienst hätte ich gern</em><div>${tile("F", "Früh", "sun")}${tile("Z", "Zwischen", "clock")}${tile("S", "Spät", "clock")}${tile("N", "Nacht", "moon", "k")}</div></div>
    <div class="tg"><em>Arbeiten ja, aber so nicht</em><div>${tile("!S", "kein Spät", "cross", "n")}${tile("!N", "keine Nacht", "cross", "n")}</div></div>
  </div>
  <div class="row2">
    ${note("cal", "<b>Abgabe bis …</b> steht über dem Kalender. Ist die Wunschabgabe geschlossen, kannst du noch ansehen, aber nicht mehr ändern.")}
    ${note("spark", "<b>Wünsche sind Wünsche.</b> Sie werden so weit wie möglich berücksichtigt. Eine Garantie gibt es nicht.", "acc")}
  </div>
`));

/* 8 Hinweise + Datenschutz */
const day = (n, cls, code, hint) => `<div class="dayc ${cls}"><i>${n}</i>${code ? `<b>${code}</b>` : ""}${hint ? `<span>${hint}</span>` : ""}</div>`;
pages.push(page("Bereich B", "Hinweise &amp; Datenschutz", `
  <p class="lead">Du siehst, ob es an einem Tag eng wird. Du siehst nie, wer dahintersteckt.</p>
  <div class="hints">
    <div>${day(12, "", "X", "")}<h3>Frei</h3><p>Kein Hinweis: bisher hat niemand sonst aus deiner Ebene etwas eingetragen.</p></div>
    <div>${day(13, "some", "X", "1 weiterer Freiwunsch")}<h3>Grau</h3><p>Andere haben auch Wünsche. Voraussichtlich machbar.</p></div>
    <div>${day(14, "tight", "X", "2× Urlaub/Fortbildung")}<h3>Rot</h3><p>Mindestens ein Drittel deiner Ebene ist schon weg. Es wird eng, lieber ausweichen.</p></div>
  </div>
  <h2>Wer sieht was?</h2>
  <div class="see">
    <div class="who"><svg viewBox="0 0 70 100">${fig(3, 0, 100, A)}</svg><b>Du</b></div>
    <div class="what">${ic("eye", 30)}<p><b>Deine Wünsche.</b> Sehen, ändern, löschen. Für andere eintragen geht technisch nicht.</p></div>
    <div class="who"><svg viewBox="0 0 110 100">${fig(0, 8, 92)}${fig(46, 8, 92)}</svg><b>Deine Ebene</b></div>
    <div class="what">${ic("eyeoff", 30)}<p><b>Nur Zahlen.</b> Keine Namen, keine Notizen. „2 weitere Freiwünsche“, mehr nicht.</p></div>
    <div class="who"><svg viewBox="0 0 70 100">${fig(3, 0, 100, T)}</svg><b>Dienstplanung</b></div>
    <div class="what">${ic("eye", 30)}<p><b>Alle Wünsche mit Namen.</b> Ohne das lässt sich kein Plan bauen.</p></div>
  </div>
  <div class="row3">
    ${note("users", "<b>Kleine Ebene?</b> Bei weniger als drei anderen gibt es keinen Hinweis. Eine Zahl würde sonst auf eine Person zeigen.")}
    ${note("lock", "<b>Passwörter</b> liegen nie im Klartext vor. Auch die Dienstplanung kann sie nicht lesen.")}
    ${note("spark", "<b>Der Assistent</b> schickt für eine Antwort Namen und Dienste an einen externen KI-Dienst. Wünsche nie.")}
  </div>
`));

/* 9 Dienstplanung */
const cyc = [["users", "Wünsche sammeln", "Übersicht aller Personen und Tage. „Abgabe bis“ setzen."], ["lock", "Schließen", "„Wunschabgabe schließen“. Wieder öffnen geht jederzeit."], ["down", "Paket laden", "„Planungspaket herunterladen“: Wünsche, Personal, letzte Dienste."], ["cog2", "Plan bauen", "Das Paket geht in den Plan-Generator. Heraus kommt der Monatsplan."], ["up", "Entwurf hochladen", "Als PDF. Nur die Dienstplanung sieht ihn: „Ansehen“."], ["stamp", "Verabschieden", "Jetzt sehen ihn alle unter „Aktuell“. „Zurück zum Entwurf“ blendet ihn wieder aus."]];
pages.push(page("Nur mit Planer-Recht", "Für die Dienstplanung", `
  <div class="cycle">
    <svg viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="104" fill="none" stroke="#111" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>
      ${cyc.map((c, i) => { const a = (-90 + i * 60) * Math.PI / 180, x = 150 + 104 * Math.cos(a), y = 150 + 104 * Math.sin(a); return `<circle cx="${x}" cy="${y}" r="30" fill="${i === 5 ? A : i === 3 ? T : "#fff"}" class="ln"/><g transform="translate(${x - 15.6} ${y - 15.6}) scale(1.3)" class="icg ${i === 5 ? "w" : ""}">${ICONS[c[0]]}</g><circle cx="${x + 24}" cy="${y - 24}" r="11" fill="#111"/><text x="${x + 24}" y="${y - 19.5}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff">${i + 1}</text>`; }).join("")}
      <text x="150" y="143" text-anchor="middle" font-size="15" font-weight="800">jeden</text><text x="150" y="163" text-anchor="middle" font-size="15" font-weight="800">Monat</text>
    </svg>
    <ol>${cyc.map((c, i) => `<li><span class="co">${i + 1}</span><p><b>${c[1]}.</b> ${c[2]}</p></li>`).join("")}</ol>
  </div>
  <p class="fine up">Alles davon im Reiter „Planung“, Abschnitt „Dienstplanung“. Ein korrigierter Plan wird einfach neu hochgeladen und ersetzt den Monat.</p>
  <h2>Personal pflegen</h2>
  <div class="steps three low">
    ${step(1, "Neue Person", "Einstellungen → Personal: Name, Ebene, Stelle. „Anlegen“.", `<svg viewBox="0 0 150 70">${fig(46, 4, 62, T)}<circle cx="104" cy="24" r="13" fill="${A}" class="ln"/><path d="M104 17v14M97 24h14" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`)}
    ${step(2, "Code erzeugen", "„Neuen Code erzeugen“. Er gilt einmal.", `<svg viewBox="0 0 150 70"><g transform="translate(40 0) scale(2.9)" class="icg">${ICONS.ticket}</g></svg>`)}
    ${step(3, "Persönlich weitergeben", "Nicht per Mail oder Chat.", `<svg viewBox="0 0 150 70">${fig(22, 4, 62, T)}${fig(88, 4, 62)}<path d="M62 36h24" class="ln" marker-end="url(#ah)"/></svg>`)}
  </div>
  <div class="row3">
    ${note("users", "<b>Jemand geht?</b> Haken bei „Aktiv“ raus. Die Person verschwindet aus Listen und Wunschabgabe.")}
    ${note("key", "<b>Seitenpasswort ändern:</b> Einstellungen → Verwaltung. Wer angemeldet ist, bleibt es.")}
    ${note("save", "<b>Sicherung:</b> „Sicherung herunterladen“ ab und zu. „Sicherung einspielen“ stellt alles wieder her.")}
  </div>
`));

/* 10 Regeln */
const bar = (l, t, a, b, cls = "") => { const seg = (x, y) => `<i class="${cls}" style="left:${x / 24 * 100}%;width:${(y - x) / 24 * 100}%"></i>`; return `<div class="tl"><b>${l}</b><div class="trk">${b > 24 ? seg(a, 24) + seg(0, b - 24) : seg(a, b)}</div><span>${t}</span></div>`; };
pages.push(page("Zum Schluss", "Spielregeln", `
  <div class="rules">
    <div><div class="rbig">11<small>h</small></div><b>Ruhezeit</b><p>zwischen zwei Diensten. Darunter schlägt die Anwendung nichts vor.</p></div>
    <div><div class="rbig">24<small>h</small></div><b>am Stück</b><p>höchstens. Längere Ketten werden aussortiert.</p></div>
    <div><div class="rbig">30<small>Tage</small></div><b>angemeldet</b><p>bleibt dein Gerät. Danach einmal neu anmelden.</p></div>
  </div>
  <h2>Die Dienste über den Tag</h2>
  <div class="tls">
    <div class="tl head"><b></b><div class="trk">${[0, 6, 12, 18, 24].map(h => `<em style="left:${h / 24 * 100}%">${h}</em>`).join("")}</div><span></span></div>
    ${bar("F", "07:45 – 16:15", 7.75, 16.25)}
    ${bar("Z", "10:00 – 18:30", 10, 18.5)}
    ${bar("S", "15:30 – 00:00", 15.5, 24, "a")}
    ${bar("N", "21:00 – 09:00", 21, 33, "k")}
  </div>
  <p class="fine up">Alle Kürzel mit Uhrzeiten findest du in der Anwendung unter „Legende &amp; Schichtzeiten“.</p>
  <div class="help">
    <svg viewBox="0 0 200 150">${fig(18, 26, 118, T)}<path d="M92 20h88a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10h-56l-18 16 4-16h-18a10 10 0 0 1-10-10V30a10 10 0 0 1 10-10z" fill="#fff" class="ln"/><text x="136" y="64" text-anchor="middle" font-size="34" font-weight="900">?</text></svg>
    <div><h2>Hängt etwas?</h2><p>Sprich die Dienstplanung an. Die Anwendung wächst mit eurem Feedback und lässt sich schnell anpassen.</p>
    <div class="url dark">${ic("link", 18)} chunkyfire.github.io/dienstplan</div></div>
  </div>
  <p class="fine">Die Anwendung dient ausschließlich der internen Organisation und Übersicht der Personaleinsatzplanung. Sie ist kein Medizinprodukt, hat keine medizinische Zweckbestimmung, verarbeitet keine Patientendaten und trifft keine medizinischen Entscheidungen.</p>
`));

/* ---------- Stil ---------- */
const css = `
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Inter,sans-serif;color:#111;font-size:11pt;line-height:1.4}
main *{min-width:0}
.page{width:210mm;height:297mm;padding:15mm 16mm 13mm;position:relative;page-break-after:always;overflow:hidden;display:flex;flex-direction:column}
.ln{stroke:#111;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
svg text{font-family:Inter,sans-serif}
.ic,.icg{fill:none;stroke:#111;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.icg.w{stroke:#fff}
.sl{font-size:11px;font-weight:600}.sl.b{font-weight:800;font-size:12.5px}
header{margin-bottom:6mm}
.kick{font-size:8.5pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${A}}
h1{font-family:"Inter Display",Inter,sans-serif;font-weight:900;font-size:37pt;letter-spacing:-.035em;line-height:1.02;margin-top:1mm}
h2{font-family:"Inter Display",Inter,sans-serif;font-weight:800;font-size:17pt;letter-spacing:-.02em;margin:9mm 0 4mm}
h3{font-weight:800;font-size:12pt;letter-spacing:-.01em}
main{flex:1;display:flex;flex-direction:column}
footer{display:flex;justify-content:space-between;align-items:center;margin-top:4mm}
.pn{width:8.5mm;height:8.5mm;border:2.2px solid #111;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:9.5pt}
.wm{font-family:"Inter Display";font-weight:900;font-size:8.5pt;letter-spacing:.22em}
.lead{font-size:13pt;font-weight:500;letter-spacing:-.01em;max-width:150mm;line-height:1.3}
.fine{font-size:7.6pt;color:#555;line-height:1.4;margin-top:auto;padding-top:4mm}
.fine.up{margin-top:2.5mm;padding-top:0}
.dot{display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;border:1.6px solid #111;vertical-align:-.2mm;margin:0 .6mm 0 1mm}
.co{flex:none;display:inline-grid;place-items:center;width:6.4mm;height:6.4mm;border-radius:50%;background:#111;color:#fff;font-weight:800;font-size:8.6pt}

/* Titel */
.cover{padding:18mm 18mm 16mm}
.ctop{display:flex;gap:2.5mm}
.ctag{background:#111;color:#fff;font-weight:800;font-size:9pt;letter-spacing:.14em;text-transform:uppercase;padding:1.8mm 4mm;border-radius:99px}
.ctag.ghost{background:#fff;color:#111;border:2.2px solid #111;padding:1.4mm 4mm}
.ctitle{font-size:104pt;line-height:.86;letter-spacing:-.055em;margin-top:9mm}
.csub{font-size:17pt;font-weight:600;margin-top:6mm;letter-spacing:-.015em}
.csub::before{content:"";display:inline-block;width:11mm;height:3.2mm;background:${A};border-radius:99px;margin-right:3.5mm}
.cart{width:100%;margin-top:auto}
.cfoot{display:flex;justify-content:space-between;align-items:center;margin-top:9mm}
.pills{display:flex;gap:2mm}.pills span{border:2.2px solid #111;border-radius:99px;padding:1.6mm 4.2mm;font-weight:700;font-size:10pt}
.pills span:first-child{background:${A};color:#fff}
.url{display:flex;align-items:center;gap:2mm;font-weight:700;font-size:10.5pt}
.url.dark{background:#111;color:#fff;border-radius:99px;padding:2mm 4.5mm;width:max-content;margin-top:3.5mm}.url.dark .ic{stroke:#fff}

/* Mini-Bildschirm */
.scr{border:2.6px solid #111;border-radius:3.2mm;background:#fff;overflow:hidden;width:100%}
.scr .bar{height:4.2mm;border-bottom:2.2px solid #111;display:flex;align-items:center;gap:1mm;padding-left:2mm}
.scr .bar i{width:1.5mm;height:1.5mm;border-radius:50%;background:#111}
.scrb{padding:2.2mm}
.tabs{display:flex;gap:1mm;margin-bottom:2mm}
.tabs span{font-size:6.2pt;font-weight:700;border:1.5px solid #111;border-radius:99px;padding:.5mm 1.9mm}
.tabs .on{background:#111;color:#fff}
.tabs span{white-space:nowrap}.part .tabs{gap:.6mm}.part .tabs span{font-size:5.2pt;padding:.4mm 1.2mm}
.mini{height:24mm;border-radius:1.6mm}
.wkm{background:repeating-linear-gradient(90deg,#111 0 1.6px,transparent 1.6px 14.285%),repeating-linear-gradient(0deg,#111 0 1.6px,transparent 1.6px 25%);border:1.6px solid #111;border-left:0;border-top:0}
.calm{display:grid;grid-template-columns:repeat(7,1fr);gap:1mm}
.calm i{border:1.5px solid #111;border-radius:1mm}.calm i.a{background:${A}}.calm i.k{background:#111}
.setm{display:flex;flex-direction:column;gap:1.6mm;justify-content:center}
.setm i{height:3.4mm;border:1.5px solid #111;border-radius:99px}.setm i.s{width:40%;background:#111}
.addr{display:flex;align-items:center;gap:1.5mm;border:1.6px solid #111;border-radius:99px;padding:1mm 2mm;margin:9mm 0}
.addr b{flex:1;height:1.6mm;background:#111;border-radius:9px;max-width:60%}
.form{display:flex;flex-direction:column;gap:1.6mm;padding:1.5mm 0;min-height:24mm;justify-content:center}
.form .in{font-style:normal;font-size:6.6pt;font-weight:700;border:1.6px solid #111;border-radius:1.6mm;padding:1mm 2mm;letter-spacing:.06em}
.form .in.code{background:${T};letter-spacing:.2em}
.form .btn{font-style:normal;font-size:6.6pt;font-weight:800;background:#111;color:#fff;border-radius:1.6mm;padding:1.1mm 2mm;text-align:center}
.form .btn.a{background:${A}}

/* Teile */
.parts{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.part{position:relative;border:2.6px solid #111;border-radius:5mm;padding:11mm 5mm 7mm}
.part h3{font-size:16pt;margin-top:4.5mm}.part p{font-size:10pt;margin-top:1mm;padding-right:6mm}
.pid{position:absolute;top:-2.6px;left:-2.6px;background:#111;color:#fff;font-weight:900;font-size:12pt;width:9mm;height:9mm;display:grid;place-items:center;border-radius:5mm 0 3mm 0}
.qty{position:absolute;right:4mm;bottom:3.5mm;font-weight:900;font-size:13pt}
.need{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.need>div{display:grid;grid-template-columns:auto 1fr;column-gap:3.5mm;align-items:center}
.need .big{grid-row:span 2;width:20mm;height:20mm;border-radius:50%;background:${T};border:2.6px solid #111;display:grid;place-items:center}
.need b{font-size:12pt;align-self:end}.need span{font-size:9.4pt;align-self:start;color:#333}
.yesno{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:4mm}
.yesno>div{display:flex;align-items:center;gap:3mm;border:2.6px solid #111;border-radius:4mm;padding:6mm 4.5mm;font-weight:700;font-size:10.6pt}
.yesno .yes{background:${T}}.yesno .no .ic{stroke:${A};stroke-width:3}.yesno .yes .ic{stroke-width:3}

/* Schritte */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.step{position:relative;padding-top:1mm}
.step .num{font-family:"Inter Display";font-weight:900;font-size:27pt;line-height:1;letter-spacing:-.04em}
.step .art{margin:2mm 0 2.6mm}.step .art svg{width:100%;display:block}
.steps.three .art{border:2.6px solid #111;border-radius:4mm;padding:1.5mm;background:#fff}
.steps.low .art svg{height:27mm}
.step p{font-size:10pt;margin-top:.6mm;color:#222}
.lane{border:2.6px solid #111;border-radius:6mm;padding:6mm 7mm 7mm;margin-bottom:6mm}
.lane.acc{background:${T}}
.lh{display:flex;align-items:center;gap:3.5mm;margin-bottom:2mm}
.lh h2{margin:0;font-size:19pt}
.tag{background:#111;color:#fff;font-weight:800;font-size:7.8pt;letter-spacing:.12em;text-transform:uppercase;padding:1.2mm 3mm;border-radius:99px}
.with{margin-left:auto;display:flex;align-items:center;gap:1.6mm;font-weight:700;font-size:9.6pt}
.note{display:flex;gap:3mm;align-items:flex-start;border:2.2px solid #111;border-radius:4mm;padding:4mm 4.5mm;font-size:9.8pt}
.note .ic{flex:none;margin-top:.3mm}.note.acc{background:${T}}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:auto}
.row3{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:auto}.row3.flat{margin-top:0}
.row3 .note{font-size:9.3pt;flex-direction:column;gap:1.6mm}

/* Aktuell */
.anno{position:relative;padding:0 7mm}
.anno .scrb{padding:3mm}
.wktop{display:flex;gap:1.2mm;margin:1mm 0 2.4mm}.wktop .sp{flex:1}
.nav{font-size:6.6pt;font-weight:800;border:1.6px solid #111;border-radius:99px;padding:.5mm 2.2mm;display:flex;align-items:center}
.nav .dot{margin:0;width:2.1mm;height:2.1mm}
.wk{display:grid;grid-template-columns:17mm repeat(7,1fr);border:2px solid #111;border-radius:2mm;overflow:hidden}
.wkh{font-size:7pt;font-weight:800;text-align:center;padding:1mm 0;border-bottom:2px solid #111;border-left:1.4px solid #111}
.wkh:first-child{border-left:0}.wkh.we,.wkc.we{background:#F1F1F1}.wkh.today{background:#111;color:#fff}
.wkl{font-size:6.6pt;font-weight:800;padding:1.2mm 1.4mm;border-bottom:1.4px solid #111;display:flex;align-items:center;line-height:1.15}
.wkc{border-left:1.4px solid #111;border-bottom:1.4px solid #111;padding:1mm;display:flex;flex-direction:column;gap:.8mm;justify-content:center}
.wkc.hit{background:${T};outline:2.4px solid ${A};outline-offset:-2.4px}
.nm{display:flex;align-items:center;gap:.7mm;height:2.3mm}.nm .dot{width:1.9mm;height:1.9mm;margin:0;border-width:1.2px}.nm b{height:1.3mm;background:#111;border-radius:9px}
.wkl.free,.wkc.free{border-bottom:0;background:#fff;border-top:1.2px solid #111;padding-top:1.6mm;padding-bottom:1.6mm}.wkc.free.we{background:#F1F1F1}
.nm.first b{background:${A}}
.anno .co{position:absolute;box-shadow:0 0 0 2.2px #fff}
.p1{left:3mm;top:12.5mm}.p2{right:3mm;top:12.5mm}.p3{left:3mm;top:43mm}.p4{left:58mm;top:27.8mm}.p5{left:85.5mm;top:46.5mm}.p6{left:3mm;bottom:6mm}
.legend{display:grid;grid-template-columns:1fr 1fr;gap:3.2mm 6mm;margin-top:6mm}
.legend>div{display:flex;gap:2.4mm;align-items:flex-start;font-size:9.8pt}.legend p{padding-top:.5mm}
.chips{display:grid;grid-template-columns:repeat(4,1fr);gap:3.5mm}
.chip{border:2.6px solid #111;border-radius:4mm;padding:4.5mm 3.8mm 5mm;display:flex;flex-direction:column;gap:.6mm}
.chip b{font-size:10.4pt;margin-top:1.5mm}.chip span{font-size:8.8pt;color:#333}
.chip.ok{background:${A};color:#fff}.chip.ok span{color:#fff}.chip.ok .ic{stroke:#fff;stroke-width:3}
.chip.off{background:#111;color:#fff}.chip.off span{color:#ddd}.chip.off .ic{stroke:#fff}

/* Ausfall */
.sol{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.sol>div{position:relative;border:2.6px solid #111;border-radius:5mm;padding:4mm 4.5mm 4.5mm}
.sol h3{padding-left:9mm}.sol svg{width:68%;display:block;margin:1mm auto 1mm}
.sol p{font-size:9.8pt;text-align:center}
.sn{position:absolute;left:3.6mm;top:3mm;width:6.4mm;height:6.4mm;border-radius:50%;background:#111;color:#fff;display:grid;place-items:center;font-weight:800;font-size:8.6pt}

/* Einspringliste */
.queue{width:100%;margin-top:7mm}
.lv3{display:flex;gap:6mm;align-items:center;font-weight:700;font-size:9.6pt;margin-top:1mm}
.lv3 em{margin-left:auto;font-style:normal;font-weight:500;color:#444}

/* Wünsche */
.tiles{display:flex;flex-direction:column;gap:4.5mm}
.tg{display:grid;grid-template-columns:40mm 1fr;align-items:center}
.tg em{font-style:normal;font-weight:700;font-size:10.4pt;padding-right:4mm}
.tg>div{display:flex;gap:3mm}
.tile{width:31mm;border:2.6px solid #111;border-radius:4mm;padding:3.4mm 3.4mm 3.6mm;position:relative}
.tile b{font-family:"Inter Display";font-weight:900;font-size:25pt;letter-spacing:-.03em;line-height:1.05;display:block}
.tile span{font-size:9.2pt;font-weight:600}
.tile .ic{position:absolute;right:2.4mm;top:2.6mm}
.tile.a{background:${A};color:#fff}.tile.a .ic{stroke:#fff}
.tile.k{background:#111;color:#fff}.tile.k .ic{stroke:#fff}
.tile.n b{color:${A}}

/* Hinweise */
.hints{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin-top:8mm}
.hints h3{margin-top:3mm;font-size:13pt}.hints p{font-size:9.8pt}
.dayc{height:31mm;border:2.6px solid #111;border-radius:4.5mm;padding:2.6mm 3.2mm;position:relative}
.dayc i{font-style:normal;font-weight:800;font-size:10pt}
.dayc b{position:absolute;right:3mm;top:2.4mm;background:${A};color:#fff;border-radius:2mm;font-size:10pt;padding:.3mm 2.2mm}
.dayc span{position:absolute;left:3mm;right:3mm;bottom:3mm;font-size:8.4pt;font-weight:700;border-radius:99px;padding:1mm 2.6mm;background:#E9E9E9}
.dayc.tight{border-color:${A};background:${T}}.dayc.tight span{background:${A};color:#fff}
.see{display:grid;grid-template-columns:32mm 1fr;gap:3.4mm 5mm;align-items:center}
.who{text-align:center}.who svg{height:21mm;display:block;margin:0 auto}.who b{font-size:9pt}
.what{display:flex;gap:4mm;align-items:center;border:2.6px solid #111;border-radius:4.5mm;padding:4.4mm 5.5mm;font-size:10.6pt}
.what .ic{flex:none}
.see .what:nth-of-type(4){border-style:dashed}

/* Dienstplanung */
.cycle{display:grid;grid-template-columns:80mm 1fr;gap:7mm;align-items:center}
.cycle svg{width:100%}
.cycle ol{list-style:none;display:flex;flex-direction:column;gap:3.4mm}
.cycle li{display:flex;gap:2.6mm;align-items:flex-start;font-size:10pt}.cycle li p{padding-top:.5mm}

/* Regeln */
.rules{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.rules>div{border:2.6px solid #111;border-radius:5mm;padding:6mm 5.5mm 6.5mm}
.rules>div:first-child{background:${A};color:#fff}
.rbig{font-family:"Inter Display";font-weight:900;font-size:50pt;letter-spacing:-.05em;line-height:1}
.rbig small{font-size:15pt;letter-spacing:0;margin-left:1mm}
.rules b{font-size:12pt}.rules p{font-size:9.8pt;margin-top:.6mm}
.tls{display:flex;flex-direction:column;gap:3.4mm}
.tl{display:grid;grid-template-columns:9mm 1fr 27mm;gap:3mm;align-items:center}
.tl>b{font-family:"Inter Display";font-weight:900;font-size:15pt}
.tl>span{font-size:8.8pt;font-weight:600;font-variant-numeric:tabular-nums}
.trk{position:relative;height:8mm;border:2.2px solid #111;border-radius:99px;overflow:hidden;background:repeating-linear-gradient(90deg,transparent 0 calc(25% - 1px),#bbb calc(25% - 1px) 25%)}
.trk i{position:absolute;top:0;bottom:0;background:${T};border-left:2.2px solid #111;border-right:2.2px solid #111}
.trk i.a{background:${A}}.trk i.k{background:#111}
.tl.head .trk{border:0;background:none;height:4mm;overflow:visible}
.tl.head em{position:absolute;transform:translateX(-50%);font-style:normal;font-size:7.6pt;font-weight:700}
.tl.head em:first-child{transform:none}.tl.head em:last-child{transform:translateX(-100%)}
.help{display:grid;grid-template-columns:52mm 1fr;gap:6mm;align-items:center;border:2.6px solid #111;border-radius:6mm;padding:5mm 7mm;margin-top:10mm;background:${T}}
.help svg{width:100%}.help h2{margin:0 0 1.5mm;font-size:19pt}.help p{font-size:10.4pt}
`;

const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Dienstplan · Anleitung</title><style>${css}</style></head><body>${DEFS}${pages.join("\n")}</body></html>`;
fs.writeFileSync(path.join(__dirname, "handbuch.html"), html);
console.log("ok", pages.length, "Seiten");
