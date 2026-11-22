# Erlenwacht World Lab

Das Labor läuft im Browser für Desktop und Android. Im Repository-Stamm startet `python3 -m http.server 8000` eine statische Vorschau unter `http://localhost:8000/world/`. Der Node-Server unterstützt denselben Pfad. Die Welt bleibt lokal im Browser. Für den ersten Ladevorgang benötigt Three.js eine Verbindung zum CDN.

## Rundgang

1. Sammle das Totholz neben der Laternenrast mit **E** oder der eingeblendeten Aktion. Weitere Steine und Hölzer liegen bei den Laternen.
2. Laufe zum Wachtstein oder öffne **Karte**. Die Nahansicht zeigt die Umgebung, die Gesamtkarte reicht bis zur Aschenküste. Markiere ein Ziel für den Richtungspfeil oder springe im Labor direkt dorthin.
3. Baue im **Beutel** ein Wegfeuer aus drei Holz und zwei Stein. Ein gesetztes Feuer dient als Rückkehrpunkt. Fundorte, Materialien, gesammelte Ressourcen und das Feuer werden pro Seed im Browser gespeichert.
4. Schalte unter **Labor** zwischen Mobil, Ausgewogen und Weitsicht um. Vergleiche Tageszeit, Nebel und Regen sowie Fußmarsch, Hirschritt und Freiflug. Die Asset-Galerie zeigt für jeden Typ vier Varianten und drei Detailstufen mit Dreieckszahl.

**Desktop** läuft mit WASD oder Pfeiltasten. Ziehen dreht die Kamera, das Mausrad verändert den Abstand. Mit Shift sprintest du. Leertaste springt und klappt bei erneutem Drücken in der Luft den Gleiter aus. Beim Freiflug steigst du mit Leertaste und sinkst mit X. **Touch** hat einen linken Stick, Ziehen auf der Welt dreht die Kamera und rechts liegen Aktionen für Sprint, Sprung oder Flughöhe.

## Module

| Datei | Aufgabe |
| --- | --- |
| `generation.js` | Seed, Höhenfeld, Biom-Mischung, Wege und Landmarken. Mit `heightAt` und `sampleAt` können Spielsysteme Koordinaten ohne Three.js abfragen. |
| `stream.js` | Priorisierte 128-m-Chunks, drei Geländedetails mit gemeinsamen Kanten, Instanzbatches, Wasser und lokale Abfragen für Kollision und Ressourcen. |
| `assets.js` | 20 prozedurale Asset-Typen. `get(typ, lod, variante)` erstellt Geometrien bei Bedarf und teilt Materialien. |
| `traversal.js` | Eingabe, Kamera, Avatar, Kollision mit Boden und prozeduralen Hindernissen, Reittier und Gleiter. |
| `atmosphere.js`, `landmarks.js` | Himmel, Wetter, Beleuchtung und handplatzierte Ensembles. |
| `journey.js`, `map.js`, `catalog.js`, `lab.js` | Lokaler Spielstand, Kartenansicht, Asset-Vorschau und Integration der Systeme. |

Ein Seed bestimmt Gelände und Verteilung. Die Koordinaten der zehn Landmarken und des Wegenetzes sind bewusst festgelegt, damit dieselben Einstiegspunkte beim Vergleich verschiedener Seeds erreichbar bleiben. Das Höhenfeld unterstützt Oberflächen, Küsten und Wasserbecken. Frei formbare Voxel, Tunnel, Basen und Multiplayer liegen außerhalb dieses Prototyps.

Die Profilbudgets begrenzen den geladenen Radius auf 5, 7 oder 9 Chunks. Die Detailstufen reduzieren Gelände- und Asset-Komplexität mit Entfernung. Die Auflösung reagiert zusätzlich auf die gemessene Bildrate. Unter **Labor → Leistung anzeigen** stehen FPS, Auflösungsfaktor, Draw Calls, gezeichnete Dreiecke, geladene und offene Chunks sowie lokale Weltkoordinaten.
