# Erlenwacht

Erlenwacht ist ein mobiles Dark-Fantasy-RPG im Browser. Im Dammerwald lernst du den Runenstoß und sammelst deine erste Beute. Den Laternen folgend erreichst du die Enklave und den Auftrag gegen den Reliktwächter. Über das Nordtor führt die nächste Expedition ins Schwarze Moor, in den Mondbruch und bis zur Krähenwarte. Der Zielpfeil zeigt die Richtung relativ zur Kamera.

Gegner und Aufträge gewähren Erfahrung. Auf Stufe 2 lernst du die Dornlanze. Pro Stufenaufstieg erhältst du einen Punkt, mit dem du im Fähigkeitenmenü einen verfügbaren Zauber bis Rang 3 steigern kannst. Siegelbruch unterbricht vorbereitete Angriffe und öffnet den Schild des Reliktwächters. Im lokalen Chat zeigen `/hilfe`, `/quest`, `/ort` und `/wache` Spielhinweise an.

## Starten

GitHub Pages kann das Projekt direkt aus dem Repository bereitstellen. Lokal genügt ein HTTP-Server im Repository-Stammverzeichnis:

```sh
python3 -m http.server 8000
```

Öffne anschließend http://localhost:8000. Der Browser benötigt WebGL 2 und eine Internetverbindung für die fest versionierte Three.js-Abhängigkeit.

## World Lab

Öffne **Menü → World Lab** oder direkt [world/](world/). Das Solo-Labor lädt eine 8,192 × 8,192 km große, durch einen Seed reproduzierbare Welt mit sechs Biomen und zehn Reisezielen. Beginne an der Laternenrast, sammle Holz und Steine und setze im Beutel ein Wegfeuer. Die Karte kann ein Ziel markieren oder es direkt für einen Testbesuch laden.

Im **Labor** findest du drei Grafikprofile, Licht, Wetter, Hirschritt, Freiflug, Seed-Wechsel, Leistungsdaten und die 3D-Asset-Vorschau. Fortschritt und Wegfeuer werden für jeden Seed lokal gespeichert. Mehr zu Bedienung und Aufbau steht in der [World-Lab-Dokumentation](world/README.md).

## Zusammen spielen

Für einen Testraum startest du Erlenwacht mit Node.js 22 oder neuer aus dem Repository:

```sh
npm ci
npm start
```

Öffne die vom Server angezeigte URL in zwei Browserprofilen oder auf zwei Geräten. Wähle im Menü **Online**, gib je einen Namen und in beiden Fenstern denselben Raumcode ein. Starte den Versuch mit zwei frischen Spielständen oder am selben Rastpunkt, damit sich die Figuren in Sichtweite befinden. Im **Chat** gehen normale Nachrichten an den Raum. Befehle wie `/quest` funktionieren weiterhin lokal.

Ein Raum synchronisiert sichtbare Figuren, Bewegung und Chat. Gegner, Loot, Aufträge und Charakterfortschritt laufen pro Spieler und werden lokal gespeichert. Räume sind kurzlebig und nutzen Gastnamen.

GitHub Pages bietet den Solo-Modus. Der Online-Modus braucht einen erreichbaren WebSocket-Server. Für den Test im lokalen Netz startest du den Server unter Linux mit `HOST=0.0.0.0 npm start` oder in PowerShell mit `$env:HOST="0.0.0.0"; npm start`. Öffne auf dem Handy `http://<LAN-IP-des-Rechners>:8080`. Für eine HTTPS-Seite trägst du im Online-Menü die `wss://`-Adresse ein. Gib dem Server bei getrenntem Frontend und Backend die erlaubte Seiten-Origin über `ERLENWACHT_ORIGINS` mit.

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

Die [Architektur](docs/ARCHITECTURE.md) beschreibt die Modulgrenzen. Der Erlenwacht-Prototyp hat einen eigenständigen Einstieg. Die ursprüngliche [Enklave in PAG](https://github.com/Oitow/pag/tree/main/games/enklave) bleibt ein separates Projekt.
