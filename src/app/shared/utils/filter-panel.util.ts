/** True when the event occurred inside the filter dropdown panel. */
export function isInsideFilterDrop(event: Event): boolean {
  return event.composedPath().some((node) => node instanceof Element && !!node.closest('.filter-drop'));
}

/** Native select options render outside the panel; skip one outside-close. */
export function isNativeSelectInteraction(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'SELECT' || tag === 'OPTION' || !!target.closest('select');
}
