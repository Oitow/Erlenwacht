const STEP = 1 / 60;
const MAX_STEPS = 5;

// Render once per display frame and cap catch-up after a stalled frame.
export function startLoop({ update, render, performanceSample, onError }) {
  let previous;
  let accumulated = 0;
  let sampleStart;
  let frames = 0;

  function frame(now) {
    try {
      const elapsed = (now - (previous ?? now)) / 1000;
      previous = now;
      accumulated += Math.min(STEP * MAX_STEPS, elapsed);
      while (accumulated >= STEP) {
        update(STEP);
        accumulated -= STEP;
      }
      render();

      sampleStart ??= now;
      frames++;
      const sampleTime = now - sampleStart;
      if (sampleTime >= 1200) {
        performanceSample(frames * 1000 / sampleTime);
        sampleStart = now;
        frames = 0;
      }
      requestAnimationFrame(frame);
    } catch (error) {
      onError(error);
    }
  }

  document.addEventListener('visibilitychange', () => {
    previous = undefined;
    sampleStart = undefined;
    accumulated = 0;
    frames = 0;
  });
  requestAnimationFrame(frame);
}
