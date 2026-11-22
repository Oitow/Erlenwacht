const boot = document.getElementById('boot');
const bootMessage = document.getElementById('boot-message');

try {
  const { startGame } = await import('./game/game.js');
  startGame({
    onError(error) {
      console.error(error);
      boot.hidden = false;
      bootMessage.textContent = 'Die Spielwelt konnte nicht weiterlaufen. Lade die Seite neu.';
    },
  });
  document.getElementById('hud').hidden = false;
  boot.hidden = true;
} catch (error) {
  console.error(error);
  bootMessage.textContent = 'Die Spielwelt konnte nicht laden. Prüfe die Verbindung und ob WebGL verfügbar ist.';
}
