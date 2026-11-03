/**
 * Where modals are rendered (via React portals). Rendering them at the top of the
 * page means the dark overlay always covers everything — top bar and sidebar included.
 * In the tablet preview they render inside the tablet's screen instead of the browser.
 */
export function getModalRoot(): HTMLElement {
  if (typeof document === 'undefined') return null as unknown as HTMLElement;
  return (document.querySelector('.device-screen') as HTMLElement | null) ?? document.body;
}
