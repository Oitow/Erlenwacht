# Erlenwacht

Erlenwacht ist ein mobiles Dark-Fantasy-RPG im Browser. Im Dammerwald lernst du den Runenstoß und sammelst deine erste Beute. Den Laternen folgend erreichst du die Enklave und den Auftrag gegen den Reliktwächter. Über das Nordtor führt die nächste Expedition ins Schwarze Moor, in den Mondbruch und bis zur Krähenwarte. Der Zielpfeil zeigt die Richtung relativ zur Kamera.

Gegner und Aufträge gewähren Erfahrung. Auf Stufe 2 lernst du die Dornlanze. Pro Stufenaufstieg erhältst du einen Punkt, mit dem du im Fähigkeitenmenü einen verfügbaren Zauber bis Rang 3 steigern kannst. Siegelbruch unterbricht vorbereitete Angriffe und öffnet den Schild des Reliktwächters. Im lokalen Chat zeigen `/hilfe`, `/quest`, `/ort` und `/wache` Spielhinweise an.

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
| Runenstoß | Leertaste | Rune |
| Dornlanze | C | Lanze (ab Stufe 2) |
| Siegelbruch | F | Siegelbruch (ab dem Auftrag) |
| Auto-Zauber | R | Auto |
| Springen | Q | Sprung |
| Aufheben oder sprechen | E | Eingeblendete Aktion |
| Beutel | I | Beutel |
| Menü | M | Menü |
| Fähigkeiten | K | Fähigkeiten im Menü |
| Lokaler Chat | Eingabetaste | Chat |

Am Tor und später am Wachtstein werden Rastpunkte gespeichert. Beute, Ausrüstung, Stufe, vergebene Fähigkeitspunkte und Auftragsfortschritt bleiben beim Neuladen im selben Browser erhalten. Beim Tod kehrst du mit vollem Leben zum letzten Rastpunkt zurück.

## Entwicklung

Die [Architektur](docs/ARCHITECTURE.md) beschreibt die Modulgrenzen. Dieser Meilenstein ist ein lokaler Einzelspieler-Prototyp für das spätere MMO-RPG. Netzwerk, Konten und gemeinsame Welten sind künftige Erweiterungen. Der Erlenwacht-Prototyp hat einen eigenständigen Einstieg. Die ursprüngliche [Enklave in PAG](https://github.com/Oitow/pag/tree/main/games/enklave) bleibt ein separates Projekt.
