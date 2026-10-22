// Mobile browsers re-scroll the page every time the layout changes while the
// on-screen keyboard is open (a feedback box appears, the next card is dealt…).
// Pressing Enter several times in a row makes these small shifts add up and the
// screen "flies away". This guard remembers the scroll position at the moment
// Enter is pressed in a field and puts it back if the browser moved it.

const SETTLE_DELAYS_MS = [0, 60, 160, 400];

let installed = false;

export function installEnterScrollGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  let timers: number[] = [];

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter') return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

      const savedY = window.scrollY;
      timers.forEach((id) => window.clearTimeout(id));
      timers = SETTLE_DELAYS_MS.map((delay) =>
        window.setTimeout(() => {
          if (Math.abs(window.scrollY - savedY) > 1) window.scrollTo(0, savedY);
        }, delay)
      );
    },
    true
  );
}
