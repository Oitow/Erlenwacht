const boot = document.getElementById('boot');
const message = document.getElementById('boot-message');

function status(text) {
  boot.hidden = !text;
  if (text) message.textContent = text;
}

try {
  const { startLab } = await import('./lab.js');
  startLab(status);
} catch (error) {
  console.error(error);
  status('Die Welt konnte nicht geladen werden. Prüfe WebGL 2 und deine Verbindung und lade die Seite neu.');
}
