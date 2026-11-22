# Erlenwacht

Erlenwacht ist ein mobiles Dark-Fantasy-RPG im Browser. Du startest im Glutlager am Aschenpass. Wähle eine Klasse, sammle einen Rohstoff und stelle an der Werkbank einen ersten Gegenstand her. Wege führen über die Schilfsenke und den Falkenkamm zum Wegfeuer. Der Hauptpfad führt weiter in den Dammerwald, zur Enklave und in die Nordmark mit Moor, Mondbruch und Krähenwarte.

| Klasse | Primär | Zweite Fähigkeit |
| --- | --- | --- |
| Bastion | Schildhieb | Eisenwacht |
| Waldläufer | Schnellschuss | Fächerschuss |
| Runenweber | Runenstoß | Glutkreis |
| Dornhüter | Dornenwelle | Dornlanze |

Im Glutlager und bei der Torwache kannst du die Klasse wechseln. Fähigkeitenpunkte steigen mit der Charakterstufe und bleiben beim Klassenwechsel in den zugehörigen Fähigkeitenplätzen. Siegelbruch lernst du über den Auftrag gegen den Reliktwächter.

Holzhandwerk, Kräuterkunde und Schmiedekunst haben eigene Ränge. Sammeln und Herstellen geben Berufs-EP. Vorkommen wachsen nach und weiterführende Rezepte kosten auch Materialien aus dem Kampf. Entdeckte Wegfeuer verbinden Glutlager, Aschenpass, Enklave und Wachtstein. Über das Reisemenü kannst du zwischen diesen Rastpunkten reisen, solange du an einem Wegfeuer stehst.

## Starten

GitHub Pages kann das Projekt direkt aus dem Repository bereitstellen. Lokal genügt ein HTTP-Server im Repository-Stammverzeichnis:

```sh
python3 -m http.server 8000
```

Öffne anschließend http://localhost:8000. Der Browser benötigt WebGL 2 und eine Internetverbindung für die fest versionierte Three.js-Abhängigkeit.

## Steuerung

| Aktion | Tastatur und Maus | Touch |
| --- | --- | --- |
| Laufen | WASD oder Pfeiltasten | Linker Stick |
| Sprinten | Umschalt gedrückt halten | — |
| Kamera drehen | Im Spielbild ziehen | Auf dem Spielbild ziehen |
| Primäre Klassenfähigkeit | Leertaste | Beschriftete Fähigkeit |
| Zweite Klassenfähigkeit | C | Beschriftete Fähigkeit |
| Siegelbruch | F | Siegelbruch (ab dem Auftrag) |
| Auto-Zauber | R | Auto |
| Springen | Q | Sprung |
| Aufheben, sammeln, sprechen oder Wegfeuer benutzen | E | Eingeblendete Aktion |
| Beutel | I | Beutel |
| Menü | M | Menü |
| Fähigkeiten | K | Fähigkeiten im Menü |
| Lokaler Chat | Eingabetaste | Chat |

Klasse, Berufsränge, Beute, Ausrüstung, Stufe, Fähigkeiten, Wegfeuer und Aufträge bleiben beim Neuladen im selben Browser erhalten. Beim Tod kehrst du mit vollem Leben zum letzten Rastpunkt zurück. Der lokale Chat bietet mit `/hilfe`, `/quest`, `/ort` und `/wache` Spielhinweise.

## Entwicklung

Die [Architektur](docs/ARCHITECTURE.md) beschreibt die Modulgrenzen. Diese Version ist auf Einzelspieler ausgerichtet. Der bisherige Online-Stand bleibt im [GitHub-Verlauf](https://github.com/Oitow/Erlenwacht/pull/12) verfügbar.
