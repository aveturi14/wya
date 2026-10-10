'use client';

import { useId, useState } from 'react';

const ITEMS = [
  {
    q: 'Will my card be charged when I RSVP?',
    a: 'No. Saying “I’m in” saves your card. It’s only charged after the event, and only if you didn’t show up and didn’t have an excuse your host accepted.',
  },
  { q: 'Who gets the money if someone flakes?', a: 'The host. They planned, shopped and cooked for you, so a no-show’s deposit goes to them.' },
  { q: 'What if I need to cancel?', a: 'Every paid event has a cancellation cutoff set by the host. Cancel before it and you pay nothing.' },
  {
    q: 'What about maybes?',
    a: 'Maybes don’t put down a deposit. They need to switch to yes or no by the cutoff. If they don’t, they automatically become a no. We send reminders before that happens.',
  },
  { q: 'Do hosts have to use deposits?', a: 'No. Deposits are optional. Plenty of plans just need a guest list, a chat and a link.' },
  { q: 'Do my friends need the app?', a: 'Not to say yes. Invite links open on the web, so anyone can RSVP from their browser.' },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <section className="faq" id="faq">
      <div className="wrap faq-inner">
        <div>
          <p className="label">FAQ</p>
          <h2 className="section-title" data-split>
            Fair questions.
          </h2>
        </div>
        <div className="faq-list">
          {ITEMS.map((item, i) => {
            const isOpen = open === i;
            const id = `${base}-${i}`;
            return (
              <div key={item.q} className={`faq-item${isOpen ? ' is-open' : ''}`} data-reveal>
                <h3 style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    {item.q}
                    <i aria-hidden="true" />
                  </button>
                </h3>
                <div className="faq-a" id={id} role="region" aria-hidden={!isOpen}>
                  <div>
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
