const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, BorderStyle, PageBreak, Footer, PageNumber } = require("docx");

const FONT = "Aptos";
// Inline markup: **bold**. Everything else is plain text.
const runs = (text, base = {}) => text.split(/\*\*(.+?)\*\*/g).map((t, i) => new TextRun({ text: t, bold: i % 2 === 1 || base.bold, italics: base.italics, font: FONT, size: base.size }));
const p = (text, opts = {}) => new Paragraph({ children: runs(text, opts), alignment: opts.align ?? AlignmentType.JUSTIFIED, spacing: { after: 160, line: 276 }, ...opts.para });
const h1 = text => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, font: FONT })] });
const h2 = text => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, font: FONT })] });
const bullet = text => new Paragraph({ numbering: { reference: "punkte", level: 0 }, children: runs(text), alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 276 } });
let listNo = 0;
const steps = items => { const ref = `schritte${++listNo}`; numbered.push(ref); return items.map(t => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 276 } })); };
const numbered = [];
const rule = () => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "7F7F7F", space: 1 } }, spacing: { before: 240, after: 240 } });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const gap = n => Array.from({ length: n }, () => new Paragraph({ children: [] }));

const body = [
  ...gap(13),
  new Paragraph({ children: [new TextRun({ text: "Handbuch: ZNA Dienstplan", bold: true, font: FONT, size: 36 })], spacing: { after: 200 } }),
  new Paragraph({ children: [new TextRun({ text: "Selbst. Bestimmt. Arbeiten.", bold: true, font: FONT, size: 24 })], spacing: { after: 200 } }),
  new Paragraph({ children: [new TextRun({ text: "Stand: November 2026", font: FONT, size: 20, color: "595959" })] }),
  pageBreak(),

  p("Herzlich willkommen beim Dienstplan der Klinik für Akut- und Notfallmedizin. Aus den bisherigen Einzelanwendungen ist eine gemeinsame Anwendung geworden: Sie zeigt den laufenden Dienstplan, hilft bei Ausfällen und nimmt die Wünsche aller Ebenen für den nächsten Monat auf. Dieses Handbuch erklärt Ihnen die Funktionen und die Bedienung."),
  rule(),
  p("**WICHTIGER HINWEIS UND DISCLAIMER**", { align: AlignmentType.LEFT }),
  p("Bitte lesen Sie diesen Hinweis vor der Nutzung der Software.", { italics: true }),
  p("Diese Anwendung dient ausschließlich der internen Organisation, Administration und der Übersicht über die Personaleinsatzplanung."),
  p("Es handelt sich ausdrücklich **NICHT** um ein Medizinprodukt und sie hat **KEINE** medizinische Zweckbestimmung."),
  p("Die Anwendung verarbeitet keine Patientendaten und trifft keine medizinischen Entscheidungen. Vorschläge für Ersatz und Tausch sind Hilfen für die Absprache im Team; verbindlich ist, was mit der Dienstplanung vereinbart wird."),
  rule(),

  h1("1. Einführung und Zweck der Anwendung"),
  p("Die Dienstplanung wird immer komplexer. Die Anwendung soll diesen Prozess vereinfachen, dezentralisieren und transparenter machen. Inspiriert von modernen Ansätzen der lateralen Führung, wollen wir weg von starren Top-Down-Vorgaben."),
  p("**Das Ziel: Mehr Eigenverantwortung, Transparenz und Fairness.**", { align: AlignmentType.LEFT }),
  p("Neu ist, dass alles an einem Ort liegt. Die Anwendung hat drei Bereiche, zwischen denen Sie oben wie zwischen Registerkarten wechseln:"),
  bullet("**Aktuell:** der gültige Dienstplan, Woche für Woche, mit der Antwort auf die Frage, wer bei einem Ausfall einspringen kann."),
  bullet("**Planung:** Hier geben Sie Ihre Wünsche für kommende Monate ab. Die Dienstplanung sieht die Wünsche aller, erstellt daraus den nächsten Plan und verabschiedet ihn."),
  bullet("**Einstellungen:** Ihr Passwort. Für die Dienstplanung zusätzlich Personal, Zugänge und Sicherung."),
  p("Wir sehen diese Anwendung als wachsendes System, das von unserem Feedback lebt und schnell angepasst werden kann."),
  pageBreak(),

  h1("2. Zugang und Überblick"),
  h2("2.1 Zugang"),
  p("Sie erreichen die Anwendung über folgenden Link (nutzbar am PC, Tablet oder Smartphone):", { align: AlignmentType.LEFT }),
  bullet("**URL:** https://chunkyfire.github.io/dienstplan/"),
  bullet("**Seitenpasswort:** Sie erhalten es von der Dienstplanung. Es ist für alle gleich und öffnet den Bereich „Aktuell“."),
  p("Das Gerät merkt sich den Zugang 30 Tage lang. Danach fragt die Anwendung erneut nach dem Passwort."),
  h2("2.2 Zwei Stufen: ansehen und wünschen"),
  p("Der Zugang hat bewusst zwei Stufen, damit der Plan leicht erreichbar bleibt und Wünsche trotzdem persönlich sind:"),
  bullet("**Mit dem Seitenpasswort** sehen Sie den gültigen Dienstplan, die Einspringliste und die Vorschläge bei Ausfällen."),
  bullet("**Mit Ihrem persönlichen Konto** geben Sie Wünsche ab. Dafür wählen Sie Ihren Namen und Ihr eigenes Passwort. Eine E-Mail-Adresse wird nicht benötigt."),
  h2("2.3 Das persönliche Konto einrichten"),
  ...steps([
    "**Einmal-Code holen:** Die Dienstplanung gibt Ihnen einen achtstelligen Code. Er gilt genau einmal.",
    "**Bereich „Planung“ öffnen** und in der Liste Ihren Namen auswählen.",
    "**Code eingeben und Passwort wählen:** Das Passwort braucht mindestens acht Zeichen. Ab jetzt melden Sie sich nur noch mit Name und Passwort an.",
  ]),
  p("**Passwort vergessen?** Die Dienstplanung setzt Ihr Konto zurück und gibt Ihnen einen neuen Einmal-Code. Nach fünf falschen Eingaben ist die Anmeldung für zehn Minuten gesperrt."),
  pageBreak(),

  h1("3. Bereich „Aktuell“: der laufende Dienstplan"),
  h2("3.1 Die Wochenansicht"),
  p("Die Ansicht ist wie eine Tabelle aufgebaut:"),
  bullet("**Spalten:** die sieben Tage der Woche. Wochenenden und Feiertage sind farbig hinterlegt, der heutige Tag ist markiert."),
  bullet("**Zeilen:** die Dienstarten in der Reihenfolge Notarzt, Frühdienst, Zwischendienst, Spätdienst, Nachtdienst. Unter dem Frühdienst stehen FTU, Rotationen und Bürotage in einer eigenen Zeile."),
  bullet("**Namen:** Der farbige Punkt vor dem Namen zeigt die Ebene (Chefarzt, Oberarzt, Facharzt, Assistenzarzt)."),
  p("Mit den Pfeilen wechseln Sie die Woche, mit „Heute“ springen Sie zurück. Über die Schaltflächen rechts blenden Sie eine einzelne Ebene ein."),
  h2("3.2 Wer kann einspringen?"),
  p("Unter den Diensten zeigt die Anwendung für jeden Tag, wer nicht eingeteilt ist, und ordnet diese Personen ein:"),
  bullet("**Kann einspringen:** frei und mit ausreichender Ruhezeit."),
  bullet("**Eingeschränkt:** zum Beispiel nach einem Spätdienst erst ab Mittag."),
  bullet("**Freiwunsch (X):** hat sich diesen Tag frei gewünscht."),
  bullet("**Nicht einsetzbar:** Urlaub, Fortbildung, krank oder Ruhezeit nach Nachtdienst."),
  h2("3.3 Die Einspringliste"),
  p("Für jede Ebene gibt es eine Reihenfolge. Oben steht, wer als Nächstes gefragt wird; wer eingesprungen ist, rutscht ans Ende. Die Anwendung verbindet diese Liste mit dem Plan: Die freien Personen eines Tages stehen in der Reihenfolge der Liste, die ersten beiden sind mit **1** und **2** markiert."),
  bullet("**Einspringen vermerken:** Tippen Sie auf den freien Namen am betreffenden Tag und bestätigen Sie. Die Person wandert ans Ende ihrer Ebene, und alle Tage rechnen sofort neu."),
  bullet("**Reihenfolge ändern:** Klappen Sie unter dem Plan „Einspringliste“ auf und verschieben Sie Personen mit den Pfeilen."),
  p("Die Einspringliste kann jede Person mit dem Seitenpasswort ändern. Jedes vermerkte Einspringen wird gespeichert und fließt in die Planung der Folgemonate ein."),
  pageBreak(),

  h2("3.4 Ein Dienst fällt aus"),
  p("Tippen Sie auf den betroffenen Dienst. Die Anwendung sucht alle Lösungen, die das Arbeitszeitgesetz einhalten, und sortiert sie von einfach nach aufwendig:"),
  bullet("**Direkter Ersatz:** Eine freie Person übernimmt. Ein Anruf."),
  bullet("**Tausch am selben Tag:** Jemand wechselt die Schicht, eine freie Person füllt nach."),
  bullet("**Tausch zwischen zwei Tagen:** Der Ersatz gibt dafür einen Dienst am Nachbartag ab."),
  bullet("**Ringtausch:** Drei Personen verschieben sich."),
  p("Zu jeder Lösung steht, wen Sie anrufen müssen. Knappe Ruhezeiten sind als Warnung vermerkt."),
  h2("3.5 Der Ausfall-Assistent"),
  p("Unter dem Plan können Sie eine Frage in normaler Sprache stellen, zum Beispiel: „Mittwoch fällt der Nachtdienst aus, wen kann ich anrufen?“ Der Assistent bezieht sich auf die angezeigte Woche. Er erfindet keine Lösungen, sondern ruft dieselbe Prüfung auf wie in Abschnitt 3.4 und fasst das Ergebnis zusammen."),
  h2("3.6 Legende"),
  p("Unter „Legende & Schichtzeiten“ finden Sie alle Dienstkürzel mit ihren Uhrzeiten."),
  pageBreak(),

  h1("4. Bereich „Planung“: Wünsche abgeben"),
  p("Nach der Anmeldung sehen Sie einen Monatskalender mit Ihren eigenen Wünschen. Voreingestellt ist der kommende Monat; mit den Pfeilen wechseln Sie den Monat."),
  h2("4.1 Einen Wunsch eintragen"),
  ...steps([
    "**Wunsch auswählen:** Tippen Sie in der Leiste über dem Kalender auf die gewünschte Art, zum Beispiel „Wunschfrei“.",
    "**Tage antippen:** Jeder angetippte Tag erhält diesen Wunsch. So tragen Sie eine Urlaubswoche mit wenigen Klicks ein.",
    "**Zurücknehmen:** Tippen Sie denselben Tag noch einmal an oder wählen Sie „Löschen“.",
  ]),
  p("Alle Eingaben werden sofort gespeichert."),
  h2("4.2 Die Wunscharten"),
  bullet("**X (Wunschfrei):** ein Tag, an dem Sie bevorzugt nicht arbeiten möchten."),
  bullet("**U (Urlaub):** geplante Urlaubstage."),
  bullet("**FB (Fortbildung):** geplante Fortbildungstage."),
  bullet("**F, Z, S, N (Dienstwunsch):** Sie möchten an diesem Tag Früh-, Zwischen-, Spät- oder Nachtdienst."),
  bullet("**Kein Spät, keine Nacht:** Sie können an diesem Tag arbeiten, aber nicht in dieser Schicht."),
  p("**Wichtig:** Wünsche sind Wünsche. Die Dienstplanung berücksichtigt sie so weit wie möglich, eine Garantie gibt es nicht."),
  h2("4.3 Hinweise auf mögliche Konflikte"),
  p("An Tagen, an denen andere aus Ihrer Ebene ebenfalls Wünsche haben, steht ein kurzer Hinweis, zum Beispiel „2 weitere Freiwünsche“ oder „1 Urlaub/Fortbildung“. Wenn Sie selbst einen Dienst wünschen, sehen Sie auch, ob andere denselben Dienst möchten."),
  bullet("**Grau:** Es gibt weitere Wünsche, der Tag ist voraussichtlich machbar."),
  bullet("**Rot:** Mindestens ein Drittel Ihrer Ebene ist an diesem Tag bereits verplant. Es wird eng."),
  p("So können Sie ausweichen, bevor ein Konflikt entsteht."),
  h2("4.4 Abgabefrist"),
  p("Über dem Kalender steht, bis wann Wünsche für den Monat möglich sind. Schließt die Dienstplanung die Wunschabgabe, können Sie Ihre Wünsche weiter ansehen, aber nicht mehr ändern."),
  pageBreak(),

  h1("5. Datenschutz bei den Wünschen"),
  p("Wünsche sind persönlich. Deshalb gilt:"),
  bullet("**Sie sehen und ändern nur Ihre eigenen Wünsche.** Die Anwendung ordnet jeden Wunsch dem angemeldeten Konto zu; für andere einzutragen ist technisch ausgeschlossen."),
  bullet("**Von anderen sehen Sie nur Anzahlen,** nie Namen und nie Notizen."),
  bullet("**Kleine Ebenen:** Hat Ihre Ebene weniger als drei weitere Personen, erscheint kein Hinweis, weil eine Zahl dann auf eine einzelne Person zeigen würde."),
  bullet("**Die Dienstplanung sieht alle Wünsche mit Namen.** Das ist nötig, um den Plan zu erstellen."),
  p("Passwörter werden nicht im Klartext gespeichert, auch die Dienstplanung kann sie nicht lesen. Der Ausfall-Assistent sendet für die Beantwortung einer Frage Namen und Dienste an einen externen KI-Dienst; Wünsche gehören nicht dazu."),
  pageBreak(),

  h1("6. Für die Dienstplanung"),
  p("Dieser Abschnitt betrifft Personen mit Planer-Recht. Sie sehen im Bereich „Planung“ zusätzlich den Abschnitt „Dienstplanung“ und im Bereich „Einstellungen“ die Verwaltung."),
  h2("6.1 Wünsche sammeln"),
  bullet("**Übersicht:** eine Tabelle aller Personen und Tage des Monats mit den eingetragenen Wünschen. Darüber steht, wie viele Personen schon Wünsche abgegeben haben."),
  bullet("**Abgabe bis:** Das Datum erscheint bei allen über dem Kalender."),
  bullet("**Wunschabgabe schließen:** Danach kann niemand mehr ändern. Sie können sie jederzeit wieder öffnen."),
  h2("6.2 Vom Wunsch zum Plan"),
  ...steps([
    "**Planungspaket herunterladen:** eine Datei mit Personal, allen Wünschen, den letzten sieben Tagen des Vormonats, den Plänen der letzten sechs Monate, der Einspringliste und der Einspring-Historie.",
    "**Plan erstellen:** Erstellen Sie den Plan mit dem Dienstplan-Generator. Das Paket liefert ihm die Wünsche im passenden Format und die Historie (Wochenenden, Nächte, NEF-Dienste, Einspringen), damit Belastungen über die Monate ausgeglichen werden können.",
    "**Entwurf hochladen:** Laden Sie den neuen Plan als PDF unter „Neuen Plan als Entwurf hochladen“ hoch. Ein Entwurf ist nur für Planer sichtbar.",
    "**Ansehen und verabschieden:** Mit „Ansehen“ prüfen Sie den Entwurf in der gewohnten Wochenansicht. Mit „Verabschieden“ wird er zum gültigen Plan und ist sofort für alle sichtbar.",
  ]),
  p("Einen verabschiedeten Plan können Sie mit „Zurück zum Entwurf“ wieder ausblenden. Korrigierte Pläne laden Sie einfach erneut hoch; die Datei ersetzt den jeweiligen Monat."),
  h2("6.3 Personal pflegen"),
  p("Die Personalliste in den Einstellungen gilt für die ganze Anwendung: für die Ebene im Plan, die Einspringliste, die Wunschabgabe und das Planungspaket."),
  bullet("**Neue Person:** in der letzten Zeile Name, Ebene, Stellenanteil und Qualifikation eintragen und „Anlegen“ wählen. Der Name muss so geschrieben sein wie im Dienstplan."),
  bullet("**Person verlässt das Team:** den Haken bei „Aktiv“ entfernen. Die Person verliert sofort ihren Zugang, alte Pläne bleiben lesbar."),
  bullet("**Einladungscode:** erzeugt den Einmal-Code für das erste Anmelden. Bei bestehendem Konto heißt die Schaltfläche „Passwort zurücksetzen“."),
  bullet("**Planer:** Mit diesem Haken geben Sie einer weiteren Person das Planer-Recht."),
  h2("6.4 Verwaltung"),
  bullet("**Seitenpasswort:** Ändern Sie das gemeinsame Passwort, zum Beispiel nach einem Personalwechsel. Wer bereits angemeldet ist, bleibt es bis zum Ablauf der 30 Tage."),
  bullet("**KI-Modell:** legt fest, welches Modell der Ausfall-Assistent verwendet."),
  bullet("**Sicherung:** „Sicherung herunterladen“ speichert Personal, Pläne, Wünsche und Einspring-Historie als Datei, ohne Passwörter. „Sicherung einspielen“ lädt eine solche Datei wieder hoch und ergänzt, was fehlt."),
  rule(),

  h1("7. Regeln und Compliance (ArbZG)"),
  p("Alle Vorschläge für Ersatz und Tausch werden vor der Anzeige geprüft. Eine Lösung erscheint nur, wenn sie für jede beteiligte Person diese Regeln einhält:"),
  bullet("**Ruhezeit:** mindestens elf Stunden zwischen zwei Diensten. Bei weniger als zwölf Stunden erscheint eine Warnung."),
  bullet("**Höchstdauer:** nie mehr als 24 Stunden am Stück."),
  bullet("**Abwesenheiten:** Urlaub, Krankheit, Elternzeit und FTU werden nicht überplant, Freiwünsche werden respektiert."),
  bullet("**Hierarchie:** Ein Dienst wird nur von der gleichen oder einer höheren Ebene übernommen."),
  bullet("**NEF-Erfahrung:** Notarztdienste erhalten nur Personen, die bereits Notarztdienste im Plan haben."),
  bullet("**Chefarzt-Ebene:** wird nie als Ersatz vorgeschlagen."),
  p("Die Prüfung ersetzt nicht die Absprache: Ob jemand tatsächlich einspringt, entscheiden die Beteiligten und die Dienstplanung."),
  rule(),
  h1("8. Daten und Technik"),
  bullet("**Speicherort:** Personal, Pläne, Wünsche und Konten liegen in der Datenbank der Abteilung. Im öffentlich einsehbaren Programmcode stehen keine Namen und keine Pläne."),
  bullet("**Aktualität:** Die Ansicht lädt sich regelmäßig neu. Änderungen sind innerhalb einer Minute auf allen Geräten sichtbar."),
  bullet("**Unabhängigkeit:** Die Anwendung läuft ohne Baukasten-Plattform. Änderungen am Programm werden automatisch geprüft und ausgeliefert."),
  rule(),
  h1("9. Support und Feedback"),
  p("Diese Anwendung lebt von Ihrem Feedback und kann sehr schnell angepasst werden. Wenn Sie Verbesserungsvorschläge haben, Fehler finden oder Unterstützung benötigen, wenden Sie sich bitte an:"),
  p("**Cem Özel**", { align: AlignmentType.LEFT }),
  p("Wir wünschen viel Erfolg bei der eigenverantwortlichen Dienstplanung!", { italics: true, align: AlignmentType.LEFT }),
];

const doc = new Document({
  creator: "Cem Özel",
  title: "Handbuch: ZNA Dienstplan",
  styles: {
    default: {
      document: { run: { font: FONT, size: 22 } },
      heading1: { run: { font: FONT, size: 32, bold: true, color: "000000" }, paragraph: { spacing: { before: 240, after: 200 }, keepNext: true } },
      heading2: { run: { font: FONT, size: 26, bold: true, color: "000000" }, paragraph: { spacing: { before: 320, after: 160 }, keepNext: true } },
    },
  },
  numbering: {
    config: [
      { reference: "punkte", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ...numbered.map(reference => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] })),
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1417, bottom: 1134, left: 1417, right: 1417 } }, titlePage: true },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "7F7F7F" })] })] }), first: new Footer({ children: [new Paragraph({ children: [] })] }) },
    children: body,
  }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync("Dienstplan_Handbuch.docx", buf); console.log("ok", buf.length); });
