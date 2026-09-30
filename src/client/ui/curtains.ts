import type { CurtainPicture } from '../world/office';
import { h, openModal } from './dom';

export interface CurtainsOptions {
  /** What the pictures can go on (see CURTAIN_SLOTS), and the pictures there are. */
  slots: readonly { name: string }[];
  pictures: readonly CurtainPicture[];
  picked(slot: number): string;
  pick(slot: number, id: string): void;
}

/** From the lounge's couch: which picture hangs on which of the curtains, a row of them for each. */
export function openCurtains(opts: CurtainsOptions) {
  const close = h('button.btn.close', { 'aria-label': 'Close' }, '✕');
  const rows = opts.slots.map((slot, i) => {
    const buttons = opts.pictures.map((p) =>
      h(
        'button.curtain-pick',
        { type: 'button', title: p.name, 'aria-label': `${p.name} on ${slot.name.toLowerCase()}`, 'aria-pressed': String(opts.picked(i) === p.id) },
        h('img', { src: p.url, alt: '' }),
      ),
    );
    buttons.forEach((b, k) =>
      b.addEventListener('click', () => {
        opts.pick(i, opts.pictures[k].id);
        buttons.forEach((o, j) => o.setAttribute('aria-pressed', String(opts.picked(i) === opts.pictures[j].id)));
      }),
    );
    return h('section.curtain-slot', {}, h('h3.curtain-slot-name', {}, slot.name), h('div.curtain-picks', {}, ...buttons));
  });
  const el = h(
    'div.modal.curtains',
    { role: 'dialog', 'aria-label': 'Curtain pictures' },
    h('header', {}, h('h2', {}, '🎭 Curtain pictures'), close),
    h('div.body', {}, ...rows),
    h('footer', {}, h('span.grow', {}, 'Each picture fills its curtains. What you pick stays on this browser.')),
  );
  const modal = openModal(el);
  close.addEventListener('click', () => modal.close());
}
