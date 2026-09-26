/** Draai `callback` op het volgende animatieframe; zonder `requestAnimationFrame` (headless) op de
 *  eerstvolgende macrotask. Voor focusherstel en scrollcorrecties ná een React-commit. */
export function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}
