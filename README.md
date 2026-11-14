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

Im vollautomatischen Modus werden alle Fortsetzungen bewertet. Die
Gesamtübersicht zeigt den vollständigen Baum mit farbigen Rechtecken und
Verbindungen: Blau = +1, Grau = 0, Orange = −1; Weiss ist für später noch
unbewertete Knoten reserviert. Blasse Ebenen kennzeichnen X/MAX und O/MIN,
sofern die jeweilige Partie noch nicht beendet ist. Zoom und Position erlauben
die Untersuchung von Ausschnitten. Das Mausrad zoomt auf die Mausposition;
Ziehen mit der Maus, horizontaler Scroll bzw. Umschalt-Mausrad verschiebt den Ausschnitt. Alternativ
die seitlichen Bereiche mit der Maus berühren oder anklicken. Die Scrollleiste
und beide Regler bleiben synchronisiert. Die Angabe zur Breite pro Endstand zeigt,
wann einzelne Knoten in der Übersicht nicht mehr unterscheidbar sind. Bei
weniger als zwei Pixeln pro Endstand werden Knotenfarben pro Pixel gemischt.
Ein Klick zoomt bei weniger als zehn Pixeln pro Endstand zunächst auf eine
geeignete Stufe. Ab zehn Pixeln hebt Hover Knoten und direkte Folgezüge hervor;
ein Klick öffnet ihre vergrösserte Ansicht. Ein gestrichelter Pfad führt vom
aktuellen Spielstand bis zu einem Endstand: Bei gleichwertigen Folgezügen wird
der jeweils linkste gewählt. Beim Erkunden eines anderen Zweigs führt der Pfad
über diesen und anschliessend über die besten sichtbaren Folgezüge. In der
Detail- und Knotenansicht sind die sichtbaren Abschnitte desselben Pfads ebenfalls markiert.
Die Ebenenbeschriftungen
bieten Erklärungen per Tooltip bei Hover oder Tastaturfokus. In der Detailansicht
führen die Pfeile zum Elternknoten bzw. zu den Folgezügen; der markierte Pfad
in der Übersicht wird dabei aktualisiert. Die Kanten und angedeuteten weiteren
Zweige zeigen jeweils die Farbe ihres Werts. Ein Klick auf eine freie Stelle
oder ausserhalb schliesst die Detailansicht.

Der Schalter für Alpha-Beta-Pruning blendet nicht besuchte Zweige in beiden
Ansichten aus; Knoten- und Endstandszahlen beziehen sich auf den dargestellten
Baum. Die Zugreihenfolge ist zeilenweise von links oben nach rechts unten.
Da ein Alpha-Beta-Abbruch nur eine Schranke liefern kann, zeigen die Farben und
Detailwerte weiterhin separat berechnete, exakte Minimax-Werte. Die Abschneidungen
selbst folgen den beim Alpha-Beta-Verfahren zurückgegebenen Werten. Wird ein
untersuchter Zweig abgeschnitten, wird der Pfad ab seinem letzten sichtbaren
Knoten neu gewählt. In einem abgeschnittenen Teilbaum kann der beste sichtbare
Folgezug vom exakten Wert des Elternknotens abweichen.

Die Knotenansicht zeigt zunächst den aktuellen Spielstand und seine direkten
Folgezüge; weitere Zweige können einzeln aufgeklappt werden. Gleichwertige optimale Züge sind umrandet.
Die Werte entstehen durch das Maximum bzw. Minimum der direkten Folgewerte;
optionale Erklärungen zeigen diese Rechnung. Der Baum ist scrollbar. Der letzte
Zug und Gewinnreihen sind in den kleinen Spielfeldern markiert.
Gleiche Stellungen werden für die Berechnung wiederverwendet, aber für jede
Zugfolge im Baum separat dargestellt. Teilautomatischer und Schritt-für-Schritt-
Modus folgen später.

Tests mit Node.js ab Version 18:

```sh
node --test game.test.js overview.test.js
node --check app.js
node --check explorer.js
node --check overview.js
```
