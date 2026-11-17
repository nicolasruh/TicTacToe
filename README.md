# Tic-Tac-Toe · Minimax

Eine statische, deutschsprachige Webseite ohne externe Abhängigkeiten.
`index.html` direkt im Browser öffnen; alternativ:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Danach `http://127.0.0.1:8000` öffnen.

X beginnt immer. Es gibt Mensch gegen Mensch sowie beide Rollenverteilungen
gegen den Computer. Die Moduswahl startet sofort ein neues Spiel; auch der
Startknopf setzt das Spiel zurück. Der Computer spielt mit exaktem Minimax
und zeigt seinen Zug nach einer kurzen Wartezeit.

## Minimax-Explorer

Der Explorer öffnet sich für den aktuellen Spielstand als Overlay. Ein
ausstehender Computerzug wird beim Öffnen pausiert und nach dem Schliessen
fortgesetzt. X maximiert, O minimiert: +1 bedeutet X-Sieg, 0 Unentschieden
und −1 O-Sieg, jeweils bei optimalem Spiel.

Standard ist **Ende**: alle Fortsetzungen bewertet, Zoom 1× und Root als aktiver Knoten. Die
Gesamtübersicht zeigt den vollständigen Baum mit farbigen Rechtecken und
Verbindungen: Blau = +1, Grau = 0, Orange = −1; Weiss bedeutet generiert, aber
noch nicht bewertet. Blasse Ebenen kennzeichnen X/MAX und O/MIN,
sofern die jeweilige Partie noch nicht beendet ist. Zoom und Pan erlauben
die Untersuchung von Ausschnitten. Das Mausrad zoomt auf die Mausposition;
Ziehen mit der Maus, horizontaler Scroll bzw. Umschalt-Mausrad verschiebt den Ausschnitt. Alternativ
die seitlichen Bereiche mit der Maus berühren oder anklicken. Beide Regler
bleiben synchronisiert; die zusätzliche horizontale Scrollleiste entfällt.
Bei mindestens zehn Pixeln pro Endstand ohne Zoom werden Zoom/Pan und die
Randflächen ausgeblendet. Alle Ebenen passen unabhängig vom Zoom in dieselbe
feste Höhe. Die maximale Zoomstufe passt sich Baumgrösse und Fensterbreite an:
Beim Hineinzoomen sind höchstens rund 30 Pixel pro Endstand möglich.
Bei eingeblendeten Zoomcontrols zeigt die Angabe zur Breite pro Endstand,
wann einzelne Knoten in der Übersicht nicht mehr unterscheidbar sind. Bei
weniger als zwei Pixeln pro Endstand werden Knotenfarben pro Pixel gemischt.
Ein Klick auf zu kleine Knoten zeigt ausschliesslich einen Zoom-Tooltip.
Ab zehn Pixeln hebt Hover Knoten und direkte Folgezüge hervor;
ein Klick zeigt sie in der Detailansicht unter dem Graphen.
Pfeil hoch führt zum Elternknoten, runter zum linkesten Kind, links/rechts
zum benachbarten Geschwister. Die Tasten 1–9 wählen das entsprechende direkte
Kind; dieselben Controls stehen rund um den aktiven Detailknoten.
Tastatureingaben in Reglern und Eingabefeldern bleiben unverändert.
Beim Navigieren wird nötigenfalls Pan nachgeführt, nicht der Zoom.
Ein gestrichelter Pfad führt vom
aktuellen Spielstand bis zu einem Endstand: Bei gleichwertigen Folgezügen wird
der jeweils linkste gewählt. Die Auswahl eines anderen Knotens verändert den
optimalen Pfad nicht. In der Detailansicht sind die sichtbaren Abschnitte
desselben Pfads ebenfalls markiert.
Die Ebenenbeschriftungen
bieten Erklärungen per Tooltip bei Hover oder Tastaturfokus. In der Detailansicht
stehen alle Navigationscontrols am aktiven Knoten. Die Kanten und angedeuteten weiteren
Zweige zeigen jeweils die Farbe ihres Scores. Ist auf der obersten Ebene ein
Mensch am Zug, übernimmt ein Klick auf ein freies Feld des Root-Spielbretts den
Zug ins Spiel und schliesst den Explorer. Das gilt auch für durch Pruning
nicht untersuchte Züge.

**Start** setzt die Suche zurück und zeigt den ersten zu bewertenden Endstand. Bereits
generierte, noch nicht bewertete Knoten und Kanten sind weiss; spätere Zweige
erscheinen blass und gepunktet, bis die Tiefensuche sie erreicht. Für jeden
Knoten wird im Standardmodus **Auto** mit **Schritt** der nächste Score aufgedeckt.
**Abspielen** bewertet die restlichen Knoten mit einstellbarem Tempo;
**Stop** pausiert ohne Fortschrittsverlust. **Ende** zeigt sofort den fertigen
Baum, setzt Zoom und Auswahl zurück und blendet Auto/Manuell aus.
In Auto löst Return den nächsten Einzelschritt aus; dieselbe Funktion steht
als **Nächster Schritt: ↵** ganz rechts neben der mittleren Detailebene bereit.
Der eingesetzte Score bleibt kurz sichtbar, bevor die Anzeige weiterwechselt
(bei Einzelschritten 250 ms, beim Abspielen höchstens eine Tempostufe).
Währenddessen sind weitere Eingaben gesperrt. Stop übernimmt den gerade
eingesetzten Score vor dem Pausieren; Schnell behält seine gebündelten Schritte.
Der Temposlider behält die Stufen 1×, 4×, 20×, 100× und Schnell bei.
In **Manuell** kennzeichnen dunkler Hintergrund und helle Schrift den Explorer;
Baumfarben bleiben unverändert. Nur der aktive Knoten wird für Eingaben verbreitert.
Das Fragezeichen neben dem Schalter erklärt den Ablauf und die Pruning-Bedingung.
Schritt und Abspielen warten auf die Scorewahl rechts neben
dem kleinen Spielfeld. Jede Wahl wird sofort geprüft: falsche Scores werden
gemeldet, korrekte Eingaben führen automatisch zum nächsten Schritt.
Fragezeichen sind rot, die drei Scorebuttons rot umrahmt; das noch unbekannte
Scorefeld behält einen neutralen Rahmen. Bestätigte Scores sind grün umrahmt.
Bei Pruning wird nach jeder Kindrückgabe der bisher beste Score des Elternknotens
eingetragen. α und β werden automatisch aktualisiert: MAX erhöht α, MIN senkt
β; die andere Grenze bleibt unverändert. Endstände verändern keine Grenze.
Übernommene Grenzen sind weiss, angepasste blau/orange/grau nach ihrem Inhalt,
abschneidende rot. Anschliessend wird, sofern noch ein Ast möglich ist,
rechts neben α und β gefragt, ob Pruning erfüllt ist: Ja schneidet die übrigen Äste ab, Nein
generiert den nächsten. Die Entscheidungsbuttons sind rot umrahmt; falsche
Entscheidungen lassen den Zustand unverändert. Tooltips erklären die aktuelle
Übernahme, Aktualisierung und Pruning-Bedingung.
Bei **Schnell** werden bis zu 1000 Schritte pro Bild verarbeitet, damit auch
grosse Bäume in überschaubarer Zeit durchlaufen werden können.
Die Reihenfolge folgt der Tiefensuche von links nach rechts. Ohne Pruning
wird jeder innere Knoten nach seinen Kindern bewertet; bei Pruning werden
zusätzlich die Zwischen-Scores und Entscheidungen nach jeder Kindrückgabe gezeigt.
Der optimale Pfad erscheint erst
nach Abschluss. Andere Knoten können untersucht werden; **Zum aktuellen
Schritt** führt zurück. Der Fortschritt bleibt beim Wechsel zwischen
Auto und Manuell erhalten, wird aber beim Ändern von Pruning zurückgesetzt.
Am Spielbeginn sind sehr viele Schritte nötig; für kürzere Übungen kann der
Explorer aus einer fortgeschrittenen Spielsituation geöffnet werden.

Der Schalter für Alpha-Beta-Pruning steht bei den Ablaufcontrols. In der
Schrittansicht bleiben sämtliche hypothetischen Knoten sichtbar. Nach einer
Pruning-Entscheidung werden alle ausgeschlossenen Knoten und Verbindungen des
betroffenen Teilbaums blassrot; sie werden weder generiert noch bewertet und
zeigen keine vorweggenommenen Scores oder Suchgrenzen. Der Bewertungsfortschritt
zählt nur besuchte Knoten. Erst in **Ende** entfallen diese Teilbäume; rote
durchgestrichene Kanten markieren dann die abgeschnittenen direkten Äste, ohne
deren Knoten oder Nachkommen darzustellen. Die Knoten- und Endstandszahlen der
Gesamtübersicht beziehen sich jeweils auf den gerade dargestellten Baum.
Die Zugreihenfolge ist zeilenweise von links oben nach rechts unten.
Der Baum wird rekursiv per Tiefensuche aufgebaut und bewertet. Zusätzlich zum
Alpha-Beta-Abbruch endet die Suche an einem Knoten, sobald MAX den Score +1 bzw.
MIN den Score −1 erreicht: Ein besseres Ergebnis ist nicht möglich.
Die Farben und Detail-Scores zeigen die tatsächlich zurückgegebenen Such-Scores.
Ein Alpha-Beta-Abbruch kann nur eine Schranke liefern; in der Detailansicht
kennzeichnen ≤ und ≥ diese Scores. Wird ein untersuchter Zweig abgeschnitten,
bleibt der letzte sichtbare Knoten aktiv; der optimale Pfad wird aus der
neuen Suche ermittelt.

Die Detailansicht zeigt immer drei feste Ebenen: Elternknoten, aktiven Knoten
in der Mitte und direkte Folgezüge. Beim Root ersetzt der Hinweis zur Zugwahl
die oberste Ebene; bei Endständen steht die Bewertungsregel in der freien
untersten Ebene. ↓ und 1 sind als gemeinsames Control zusammengefasst;
die Kindcontrols sind leicht transparent, damit Verbindungen sichtbar bleiben.
Zoom und Pan stehen bei genügend Platz in der
Legendenzeile, der kurze Hinweis unter dem Graphen darf umbrechen.
Nachweislich gleichwertige optimale Züge sind umrandet; Schranken reichen dafür
nicht aus. Die Scores entstehen durch das Maximum bzw. Minimum der direkten
Kind-Scores. Die Detailansicht ist horizontal scrollbar. Der letzte
Zug und Gewinnreihen sind in den kleinen Spielfeldern markiert.
Die kleinen Spielfelder behalten in allen Bewertungszuständen weisse Zellen
mit kontrastreichen Umrandungen.
Erklärungen stehen als separate Tooltips an Knoten, Score, α und β – auch im Auto-Modus.
Gleiche Stellungen werden für jede Zugfolge im Baum separat dargestellt.

### Aufgabenblatt als PDF

Im Explorer erstellt **P** oder **PDF** für vollständige Bäume mit
höchstens 29 Knoten ein zweiseitiges A4-PDF: Seite 1 enthält den gesamten
Baum mit leeren Feldern für Score, α und β, Seite 2 dieselbe Darstellung mit
Lösungen. Hoch- oder Querformat wird automatisch anhand der Baumform gewählt.
Die Einstellung für Pruning wird übernommen. Nicht besuchte Knoten sind auf dem
Aufgabenblatt nicht erkennbar, auf dem Lösungsblatt schwarz durchgestrichen.
Für die Grössenbegrenzung zählen auch diese Knoten. Die α/β-Grenzen gelten beim
Verlassen des Knotens; ohne Pruning werden sie ebenfalls über die vollständige
Tiefensuche mitgeführt. ≤/≥-Schranken sind als `<=`/`>=` dargestellt.

Tests mit Node.js ab Version 18:

```sh
node --test game.test.js overview.test.js app.test.js worksheet.test.js
node --check app.js
node --check explorer.js
node --check overview.js
node --check worksheet.js
```
