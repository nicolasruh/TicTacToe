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

Standard ist **Ende**: alle Fortsetzungen bewertet, Zoom 1× und Root ausgewählt. Die
Gesamtübersicht zeigt den vollständigen Baum mit farbigen Rechtecken und
Verbindungen: Blau = +1, Grau = 0, Orange = −1; Weiss bedeutet generiert, aber
noch nicht bewertet. Blasse Ebenen kennzeichnen X/MAX und O/MIN,
sofern die jeweilige Partie noch nicht beendet ist. Zoom und Position erlauben
die Untersuchung von Ausschnitten. Das Mausrad zoomt auf die Mausposition;
Ziehen mit der Maus, horizontaler Scroll bzw. Umschalt-Mausrad verschiebt den Ausschnitt. Alternativ
die seitlichen Bereiche mit der Maus berühren oder anklicken. Die Scrollleiste
und beide Regler bleiben synchronisiert. Die Angabe zur Breite pro Endstand zeigt,
wann einzelne Knoten in der Übersicht nicht mehr unterscheidbar sind. Bei
weniger als zwei Pixeln pro Endstand werden Knotenfarben pro Pixel gemischt.
Ein Klick zoomt bei weniger als zehn Pixeln pro Endstand zunächst auf eine
geeignete Stufe. Ab zehn Pixeln hebt Hover Knoten und direkte Folgezüge hervor;
ein Klick zeigt sie in der Detailansicht unter dem Graphen. Dort steht bei
Bedarf auch ein Knopf zum Vergrössern bereit. Ein gestrichelter Pfad führt vom
aktuellen Spielstand bis zu einem Endstand: Bei gleichwertigen Folgezügen wird
der jeweils linkste gewählt. Die Auswahl eines anderen Knotens verändert den
optimalen Pfad nicht. In der Detailansicht sind die sichtbaren Abschnitte
desselben Pfads ebenfalls markiert.
Die Ebenenbeschriftungen
bieten Erklärungen per Tooltip bei Hover oder Tastaturfokus. In der Detailansicht
führen die Pfeile zum Elternknoten bzw. zu den Folgezügen. Die Kanten und angedeuteten weiteren
Zweige zeigen jeweils die Farbe ihres Werts. Ist auf der obersten Ebene ein
Mensch am Zug, übernimmt ein Klick auf ein freies Feld des Root-Spielbretts den
Zug ins Spiel und schliesst den Explorer. Das gilt auch für durch Pruning
nicht untersuchte Züge.

**Start** setzt die Suche zurück und zeigt den ersten zu bewertenden Endstand. Bereits
generierte, noch nicht bewertete Knoten und Kanten sind weiss; spätere Zweige
erscheinen blass und gepunktet, bis die Tiefensuche sie erreicht. Für jeden
Knoten wird im Standardmodus **Auto** mit **Schritt** der nächste Wert aufgedeckt.
**Abspielen** bewertet die restlichen Knoten mit einstellbarem Tempo;
**Stop** pausiert ohne Fortschrittsverlust. **Ende** zeigt sofort den fertigen
Baum, setzt Zoom und Auswahl zurück und blendet Auto/Manuell aus.
Der Temposlider behält die Stufen 1×, 4×, 20×, 100× und Schnell bei.
In **Manuell** warten auch Schritt und Abspielen auf die Wertewahl rechts neben
dem kleinen Spielfeld. Jede Wahl wird sofort geprüft: falsche Werte werden
gemeldet, vollständig korrekte Eingaben führen automatisch zum nächsten Knoten.
Fragezeichen sind rot, bestätigte Werte grün umrahmt.
Bei Pruning sind neben dem Wert auch α und β einzutragen, jeweils am Ende
der Knotenbewertung. Die beim Betreten übernommenen Grenzen stehen im
jeweiligen Tooltip. MAX aktualisiert α mit dem Maximum aus bisherigem α und
Knotenwert, MIN entsprechend β mit dem Minimum; die andere Grenze bleibt
unverändert. Endstände verändern keine Grenze. Auch −∞ und +∞ sind wählbar.
Bei **Schnell** werden bis zu 1000 Schritte pro Bild verarbeitet, damit auch
grosse Bäume in überschaubarer Zeit durchlaufen werden können.
Die Reihenfolge folgt der Tiefensuche von links nach rechts: Ein innerer Knoten
wird nach seinen besuchten Kindern bewertet. Der optimale Pfad erscheint erst
nach Abschluss. Andere Knoten können untersucht werden; **Zum aktuellen
Schritt** führt zurück. Der Fortschritt bleibt beim Wechsel zwischen
Auto und Manuell erhalten, wird aber beim Ändern von Pruning zurückgesetzt.
Am Spielbeginn sind sehr viele Schritte nötig; für kürzere Übungen kann der
Explorer aus einer fortgeschrittenen Spielsituation geöffnet werden.

Der Schalter für Alpha-Beta-Pruning blendet nicht besuchte Zweige schon vor
Beginn der schrittweisen Bewertung aus; Knoten- und Endstandszahlen beziehen sich auf den dargestellten
Baum. Die Zugreihenfolge ist zeilenweise von links oben nach rechts unten.
Der Baum wird rekursiv per Tiefensuche aufgebaut und bewertet. Zusätzlich zum
Alpha-Beta-Abbruch endet die Suche an einem Knoten, sobald MAX den Wert +1 bzw.
MIN den Wert −1 erreicht: Ein besseres Ergebnis ist nicht möglich.
Die Farben und Detailwerte zeigen die tatsächlich zurückgegebenen Suchwerte.
Ein Alpha-Beta-Abbruch kann nur eine Schranke liefern; in der Detailansicht
kennzeichnen ≤ und ≥ diese Werte. Wird ein untersuchter Zweig abgeschnitten,
bleibt der letzte sichtbare Knoten ausgewählt; der optimale Pfad wird aus der
neuen Suche ermittelt.

Die Detailansicht zeigt einen gewählten Knoten und seine direkten Folgezüge.
Ihre Höhe und die beiden Ebenen bleiben gleich; ohne Folgezüge bleibt die
zweite Ebene frei. Zoom und Position stehen bei genügend Platz in der
Legendenzeile, der kurze Hinweis unter dem Graphen darf umbrechen.
Nachweislich gleichwertige optimale Züge sind umrandet; Schranken reichen dafür
nicht aus. Die Werte entstehen durch das Maximum bzw. Minimum der direkten
Folgewerte. Der Baum ist scrollbar. Der letzte
Zug und Gewinnreihen sind in den kleinen Spielfeldern markiert.
Die kleinen Spielfelder behalten in allen Bewertungszuständen weisse Zellen
mit kontrastreichen Umrandungen.
Erklärungen stehen als separate Tooltips an Knoten, Wert, α und β – auch im Auto-Modus.
Navigationshinweise stehen unter der Darstellung.
Gleiche Stellungen werden für jede Zugfolge im Baum separat dargestellt.

Tests mit Node.js ab Version 18:

```sh
node --test game.test.js overview.test.js app.test.js
node --check app.js
node --check explorer.js
node --check overview.js
```
