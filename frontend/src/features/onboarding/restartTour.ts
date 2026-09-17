/**
 * Asks the running tour to start again.
 *
 * A window event rather than a callback passed down through the shell: the training page and
 * the tour are mounted in different parts of the tree, and threading a handler between them
 * would mean the shell holding state it has no other reason to hold.
 */
export const RESTART_TOUR_EVENT = 'lockerflow:restart-tour';

export function restartTour(): void {
  window.dispatchEvent(new Event(RESTART_TOUR_EVENT));
}
