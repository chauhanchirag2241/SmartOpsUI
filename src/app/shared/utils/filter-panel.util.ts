/** True when the event occurred inside the filter panel or its overlays. */
export function isInsideFilterDrop(event: Event): boolean {
  return event.composedPath().some((node) => {
    if (!(node instanceof Element)) {
      return false;
    }
    return !!(
      node.closest('.filter-drop') ||
      node.closest('.table-filter-menu') ||
      node.closest('.table-filter-backdrop') ||
      node.closest('.md-drppicker') ||
      node.closest('.p-datepicker') ||
      node.closest('.p-overlay') ||
      node.closest('.p-datepicker-panel')
    );
  });
}

/** Native select options render outside the panel; skip one outside-close. */
export function isNativeSelectInteraction(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'SELECT' || tag === 'OPTION' || !!target.closest('select');
}
