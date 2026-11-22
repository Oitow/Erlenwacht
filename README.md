# Erlenwacht

Erlenwacht ist ein mobiles Dark-Fantasy-RPG im Browser. Der Dammerwald führt über alte Ruinen zu einer begehbaren Enklave. Folge den Laternen, bekämpfe Schattenwesen und sprich mit der Torwache im Innenhof. Nach der Ankunft kannst du dort den Auftrag gegen den Reliktwächter annehmen. Siegelbruch öffnet seinen Schild für kurze Zeit und unterbricht gerade vorbereitete Angriffe. Der Zielpfeil zeigt die Richtung relativ zur Kamera.

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
| Siegelbruch | F | Siegelbruch (ab dem Auftrag) |
| Auto-Zauber | R | Auto |
| Springen | Q | Sprung |
| Aufheben oder sprechen | E | Eingeblendete Aktion |
| Beutel | I | Beutel |

Am Tor wird der Rastpunkt gespeichert. Beute, Ausrüstung und der Auftragsfortschritt bleiben beim Neuladen im selben Browser erhalten. Beim Tod kehrst du mit vollem Leben zum letzten Rastpunkt zurück.

## Entwicklung

Die [Architektur](docs/ARCHITECTURE.md) beschreibt die Modulgrenzen. Dieser Meilenstein ist ein lokaler Einzelspieler-Prototyp für das spätere MMO-RPG. Netzwerk, Konten und gemeinsame Welten sind künftige Erweiterungen. Der Erlenwacht-Prototyp hat einen eigenständigen Einstieg. Die ursprüngliche [Enklave in PAG](https://github.com/Oitow/pag/tree/main/games/enklave) bleibt ein separates Projekt.
