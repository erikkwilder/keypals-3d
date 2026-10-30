// Move a layer to the end of the page, so a card that opens over everything isn't held inside the box
// it was opened from (a scrolling list, a moving tile): <div use:portal>...</div>
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return { destroy() { node.remove(); } };
}
