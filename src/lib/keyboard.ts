import type { KeyboardEvent } from "react";

/**
 * Gives a non-native interactive surface the same Enter/Space activation as a button.
 * Child controls are ignored so their keyboard events cannot trigger the parent action.
 */
export function activateOnEnterOrSpace(
  event: KeyboardEvent<HTMLElement>,
  action: () => void,
) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  action();
}
