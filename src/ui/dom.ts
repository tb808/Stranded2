export type Child = Node | string | null | undefined | false;

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  append(node, ...children);
  return node;
}

export function append(parent: ParentNode, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function clear(node: ParentNode): void {
  node.replaceChildren();
}

export function button(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function percentage(current: number, max: number): number {
  return max > 0 ? clamp(current / max) : 0;
}

export function setHidden(node: HTMLElement, hidden: boolean): void {
  node.hidden = hidden;
  node.setAttribute('aria-hidden', String(hidden));
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function focusFirst(container: HTMLElement): void {
  const target = container.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  target?.focus();
}

export function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function cardinalDirection(degrees: number): string {
  const labels = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] as const;
  return labels[Math.round(normalizeDegrees(degrees) / 45) % labels.length] ?? 'N';
}

export function safeDialogOpen(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
}

export function safeDialogClose(dialog: HTMLDialogElement): void {
  if (dialog.open) dialog.close();
}
