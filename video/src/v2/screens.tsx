import { interpolate } from 'remotion';
import { pop, glide, countUp } from '../components/motion';
import { F, LOOKS, WALLET_GRADIENT } from '../styles/tokens';
import { A, AR, AS, T, shadow } from './app';
import { BILL, EVENT, LINES, ME, PAYER, PEOPLE, Person, SHARES, TICKETS_TOTAL, TICKET_CENTS, money, OWED_TO_PAYER, WALLET_START } from './data';
import { AppPoster, Av, Btn, Card, Chip, DotChip, Icon, RoundBtn, Sheet, TabBar, Tabs, TapDot } from './ui';

const PAD = AS.lg;

// ------------------------------------------------------------------ Home (app/(tabs)/home.tsx)
export function HomeScreen({ f, tapAt }: { f: number; tapAt: number }) {
  const press = f >= tapAt && f < tapAt + 6 ? 1 : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, background: A.bg, padding: `58px ${PAD}px 0` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 28, letterSpacing: -1.4, color: A.text }}>wya<span style={{ color: A.pink }}>.</span></div>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: A.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={A.text} strokeWidth="1.9" strokeLinecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>
        </div>
      </div>
      <div style={{ ...T.caption, color: A.text, marginTop: 18 }}>Hey {PAYER}</div>
      <div style={{ ...T.display, fontSize: 30 }}>Your <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400 }}>week</span></div>
      <div style={{ marginTop: 14, transform: `scale(${1 - press * 0.03})` }}>
        <AppPoster title={EVENT.title} line={EVENT.line} foot={`${EVENT.day} · ${EVENT.time}`} pill={EVENT.when} height={196} titleSize={36} />
      </div>
      <Card style={{ marginTop: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FFE3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.people}</div>
        <div style={{ flex: 1 }}>
          <div style={{ ...T.value, fontWeight: 600 }}>Invite your people</div>
          <div style={{ ...T.caption }}>{EVENT.title} · 1 going</div>
        </div>
        <Chip label="Invite" />
      </Card>
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <Chip label="All 2" on /><Chip label="Hosting 1" /><Chip label="Invited 1" /><Chip label="Past" />
      </div>
      <TabBar active={0} />
      <TapDot x={190} y={250} frame={f} at={tapAt} />
    </div>
  );
}

// ------------------------------------------------------------------ Event page (app/event/[id].tsx)
export function EventScreen({ f, going, inviteTap, sheetT }: { f: number; going: number; inviteTap: number; sheetT: number }) {
  const invited = 4;
  return (
    <div style={{ position: 'absolute', inset: 0, background: A.bg, padding: `56px ${PAD}px 0` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><RoundBtn>{Icon.back}</RoundBtn><RoundBtn>{Icon.share}</RoundBtn></div>
      <div style={{ marginTop: 10 }}>
        <AppPoster title={EVENT.title} line={EVENT.line} foot={`${EVENT.day} · ${EVENT.time}`} footRight={EVENT.place.toUpperCase()} sticker={`${going} going`} height={212} titleSize={36} />
      </div>
      <div style={{ ...T.title, marginTop: 14, fontSize: 25 }}>{EVENT.title}</div>
      <div style={{ ...T.bodySecondary, fontSize: 14 }}>Sat 14 Nov, 7:00 PM · {EVENT.place}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {[{ i: Icon.people, l: 'Invite' }, { i: Icon.megaphone, l: 'Remind' }, { i: Icon.flag, l: 'Who came' }, { i: Icon.edit, l: 'Edit' }].map((x, k) => (
          <div key={x.l} style={{ flex: 1, height: 64, borderRadius: AR.lg, background: A.surfaceAlt, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: F.body, fontWeight: 600, fontSize: 12.5, color: A.text, transform: `scale(${k === 0 && f >= inviteTap && f < inviteTap + 6 ? 0.95 : 1})` }}>
            {x.i}{x.l}
          </div>
        ))}
      </div>
      <Card style={{ marginTop: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...T.cardTitle }}>{invited} invited</div>{Icon.chevron}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: A.surfaceAlt, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ width: `${(going / invited) * 100}%`, height: '100%', background: A.success, borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, ...T.caption, color: A.text }}>
          <span><Dot c={A.success} /> {going} in</span><span><Dot c={A.warning} /> 0 maybe</span><span><Dot c={A.chipStrong} /> {invited - going} waiting</span>
        </div>
      </Card>
      <Tabs items={['Details', 'Chat', 'Bills', 'Photos']} active={0} style={{ marginTop: 12 }} />
      <TapDot x={52} y={418} frame={f} at={inviteTap} />
      <Sheet t={sheetT} height={300}>
        <div style={{ ...T.heading }}>Invite people</div>
        <div style={{ ...T.caption, marginTop: 4 }}>Send one link to the group. Everyone answers in the app.</div>
        <Card alt style={{ marginTop: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: A.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.link}</div>
          <div style={{ flex: 1 }}><div style={{ ...T.value, fontWeight: 600 }}>Invite link</div><div style={{ ...T.caption }}>{EVENT.title}</div></div>
          <Chip label={f >= inviteTap + 34 ? 'Copied' : 'Copy'} on={f >= inviteTap + 34} />
        </Card>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn title="WhatsApp" style={{ flex: 1, background: '#25D366', color: '#fff' }} />
          <Btn title="Text" variant="soft" style={{ flex: 1 }} />
        </div>
      </Sheet>
    </div>
  );
}

const Dot = ({ c }: { c: string }) => <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c, marginRight: 4, verticalAlign: 1 }} />;

/** The app's RSVP row (components/event/RsvpBar): I'm in in the event's colours, then "You're in". */
export function RsvpCard({ f, tapAt }: { f: number; tapAt: number }) {
  const yes = f >= tapAt;
  const l = LOOKS.sunset;
  return (
    <Card style={{ padding: 16, width: 372 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Av name={ME} size={30} /><div style={{ ...T.value, fontWeight: 600 }}>Are you coming?</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn title={yes ? "You're in" : "I'm in"} size="md" style={{ flex: 1.3, backgroundImage: `linear-gradient(135deg, ${l.a}, ${l.b})`, color: '#16161A', transform: `scale(${yes ? 1 + 0.06 * (1 - glide(f, tapAt, 10)) : 1})` }} />
        <Btn title="Maybe" variant="soft" style={{ flex: 1, whiteSpace: 'nowrap' }} />
        <Btn title="Can't go" variant="soft" style={{ flex: 1, whiteSpace: 'nowrap', padding: '0 10px' }} />
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ Bills tab (components/receipts/BillsTab)
function EventHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <RoundBtn>{Icon.back}</RoundBtn>
      <div style={{ width: 34, height: 34, borderRadius: 9, overflow: 'hidden' }}><AppPoster title="" height={34} radius={9} /></div>
      <div><div style={{ ...T.value, fontWeight: 600 }}>{EVENT.title}</div><div style={{ ...T.micro }}>4 going · Sat 7:00 PM</div></div>
    </div>
  );
}

export function BillsScreen({ f, tapAt }: { f: number; tapAt: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: A.bg, padding: `56px ${PAD}px 0` }}>
      <EventHeader />
      <Tabs items={['Details', 'Chat', 'Bills', 'Photos']} active={2} style={{ marginTop: 12 }} />
      <Card style={{ marginTop: 14, padding: 16 }}>
        <div style={{ ...T.heading }}>Add a bill</div>
        <div style={{ ...T.caption, marginTop: 4 }}>Paid for something? Add the receipt or type it out. Everyone ticks what they had, then pays you back.</div>
        <Btn title="Upload receipt" icon={Icon.image()} style={{ marginTop: 14 }} pressed={f >= tapAt && f < tapAt + 6 ? 1 : 0} />
        <Btn title="Type it in" variant="soft" style={{ marginTop: 8 }} />
      </Card>
      <div style={{ ...T.label, marginTop: 20 }}>Bills</div>
      <Card style={{ marginTop: 8, padding: 16 }}>
        <div style={{ ...T.caption }}>Split evenly</div>
        <div style={{ ...T.cardTitle }}>Pre-drinks · $36.00</div>
        <div style={{ ...T.bodySecondary, fontSize: 14 }}>Everyone has settled up.</div>
      </Card>
      <TapDot x={188} y={300} frame={f} at={tapAt} />
    </div>
  );
}

/** The receipt photo being read: a paper receipt and a scan line. */
export function ScanScreen({ f }: { f: number }) {
  const scan = interpolate(f, [4, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rows = [...LINES.map((l) => ({ n: `${l.qty > 1 ? l.qty + ' ' : ''}${l.name.toUpperCase()}`, a: money(l.cents).slice(1) })), { n: 'SUNDAY SURCHARGE 10%', a: money(BILL.surchargeCents).slice(1) }];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#1C1C20' }}>
      <div style={{ position: 'absolute', left: 52, right: 52, top: 120, bottom: 150, background: '#FBFAF7', transform: 'rotate(-2deg)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', padding: '26px 22px', fontFamily: F.mono, color: '#222', fontSize: 13 }}>
        <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 500 }}>NONNA'S</div>
        <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.6, marginBottom: 18 }}>TRATTORIA · SYDNEY</div>
        {rows.map((r, i) => {
          const hit = scan * (rows.length + 1) > i + 1;
          return (
            <div key={r.n} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px', borderRadius: 4, background: hit ? 'rgba(52,199,123,0.18)' : 'transparent' }}>
              <span>{r.n}</span><span>{r.a}</span>
            </div>
          );
        })}
        <div style={{ borderTop: '1px dashed #999', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}><span>TOTAL</span><span>{money(BILL.totalCents).slice(1)}</span></div>
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: 120 + scan * 520, height: 3, background: A.success, boxShadow: `0 0 24px 6px rgba(52,199,123,0.55)`, opacity: scan < 1 ? 1 : 0 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 90, textAlign: 'center', fontFamily: F.body, fontWeight: 600, fontSize: 15, color: '#fff' }}>
        {scan < 1 ? 'Reading the receipt…' : '5 lines found'}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ "What did you have?" (app/receipt/[id].tsx + ClaimView)
export function ClaimScreen({ f, tickAt, confirmAt }: { f: number; tickAt: (i: number) => number; confirmAt: number }) {
  const ticked = (i: number) => f >= tickAt(i);
  const claimed = LINES.reduce((s, l, i) => s + (ticked(i) ? l.cents : 0), 0);
  const allClaimed = claimed >= BILL.itemsCents;
  const confirmed = f >= confirmAt + 4;
  const me = SHARES[ME];
  return (
    <div style={{ position: 'absolute', inset: 0, background: A.bg, padding: `56px ${PAD}px 0` }}>
      <RoundBtn>{Icon.back}</RoundBtn>
      <div style={{ ...T.title, marginTop: 10 }}>What did you have, {ME}?</div>
      <div style={{ ...T.caption }}>{BILL.description} · paid by {PAYER}</div>
      {/* ClaimedBar */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.body, fontWeight: 700, fontSize: 14, color: A.text }}>
          <span>{money(claimed)} of {money(BILL.itemsCents)} claimed</span>
          {allClaimed && <span style={{ ...T.caption, fontWeight: 700, color: A.successText }}>All claimed</span>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: A.surfaceAlt, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ width: `${(claimed / BILL.itemsCents) * 100}%`, height: '100%', borderRadius: 3, background: allClaimed ? A.success : A.text }} />
        </div>
      </div>
      <Card style={{ marginTop: 12 }}>
        {LINES.map((l, i) => {
          const on = ticked(i);
          const mine = on && l.who.includes(ME);
          const t = on ? pop(f, tickAt(i), 260, 14) : 0;
          return (
            <div key={l.name} style={{ borderTop: i ? `1px solid ${A.border}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: AS.md, padding: '12px 12px' }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, border: `1.5px solid ${mine ? A.text : A.lineStrong}`, background: mine ? A.text : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', transform: `scale(${mine ? 0.8 + 0.2 * t : 1})` }}>
                  {mine && Icon.check('#fff', 15)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...T.value, fontSize: 14 }}>{l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}</div>
                  {on && <div style={{ ...T.caption, opacity: t }}>{l.caption}</div>}
                </div>
                <div style={{ display: 'flex' }}>
                  {on && l.who.slice(0, 4).map((w, j) => <div key={w} style={{ marginLeft: j ? -8 : 0, transform: `scale(${t})` }}><Av name={w} size={22} ring={A.surface} /></div>)}
                </div>
                <div style={{ ...T.money, fontSize: 14, minWidth: 58, textAlign: 'right' }}>{money(l.cents)}</div>
              </div>
              {l.qty > 1 && on && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 12px 48px', opacity: t }}>
                  <span style={{ ...T.caption }}>You had</span><Chip label="Shared" /><Chip label="1" on /><Chip label="2" style={{ opacity: 0.35 }} />
                </div>
              )}
            </div>
          );
        })}
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...T.caption, marginTop: 10, padding: '0 4px' }}><span>{BILL.surchargeName}</span><span>{money(BILL.surchargeCents)}</span></div>
      <div style={{ ...T.caption, padding: '0 4px' }}>Shared by what each person ordered.</div>
      {/* ShareCard */}
      <Card style={{ marginTop: 12, padding: 16, opacity: allClaimed ? 1 : 0.4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ ...T.cardTitle }}>Your share</span><span style={{ ...T.cardTitle, fontFamily: F.mono, fontWeight: 500 }}>{money(me.total)}</span></div>
        <div style={{ ...T.caption, marginTop: 2 }}>{money(me.food)} food + {money(me.extra)} of sunday surcharge</div>
        {confirmed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, ...T.value, fontSize: 14 }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: A.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.check('#fff', 12)}</div>
            Confirmed. {PAYER} locks it once everyone has.
          </div>
        ) : (
          <Btn title="Confirm my share" style={{ marginTop: 12 }} pressed={f >= confirmAt && f < confirmAt + 4 ? 1 : 0} />
        )}
      </Card>
      <TapDot x={188} y={700} frame={f} at={confirmAt} />
    </div>
  );
}

// ------------------------------------------------------------------ Pay sheet (components/wallet/PaySheet)
export function PayScreen({ f, sheetT, payAt }: { f: number; sheetT: number; payAt: number }) {
  const me = SHARES[ME];
  const done = f >= payAt + 6;
  const doneT = done ? pop(f, payAt + 6, 200, 14) : 0;
  const items = [
    { n: 'Margherita', a: 2400 },
    { n: 'Spritz · 1 of 2', a: 1600 },
    { n: 'Garlic bread · split 4 ways', a: 300 },
    { n: 'Your share of the surcharges and tips', a: me.extra },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ClaimScreen f={9999} tickAt={() => 0} confirmAt={0} />
      <Sheet t={sheetT} height={620}>
        {!done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: AS.lg }}>
            <div style={{ ...T.heading, textAlign: 'center' }}>Pay {PAYER}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: AS.md }}>
              <Av name={PAYER} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ ...T.caption }}>You're paying</div>
                <div style={{ ...T.cardTitle }}>{PAYER}</div>
                <div style={{ ...T.caption }}>For {BILL.description} · {EVENT.title}</div>
              </div>
            </div>
            <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderRadius: AR.lg, background: A.surfaceAlt }}>
              <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 40, letterSpacing: -1, color: A.text }}>{money(me.total)}</div>
              <div style={{ ...T.caption }}>Your exact share. Only this amount can be paid, only to {PAYER}.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((it) => (
                <div key={it.n} style={{ display: 'flex', ...T.caption }}><span style={{ flex: 1 }}>{it.n}</span><span style={{ fontFamily: F.mono, color: A.text }}>{money(it.a)}</span></div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: AS.md }}>
              {Icon.wallet}
              <div><div style={{ ...T.value }}>From your wya wallet</div><div style={{ ...T.caption }}>Balance {money(WALLET_START)} · {money(WALLET_START - me.total)} left after</div></div>
            </div>
            <Btn title={`Pay ${PAYER} ${money(me.total)}`} icon={Icon.lock()} pressed={f >= payAt && f < payAt + 5 ? 1 : 0} />
            <div style={{ ...T.caption, textAlign: 'center' }}>Nothing is paid until you tap Pay.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: AS.md, paddingTop: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: A.text, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${doneT})` }}>{Icon.check('#fff', 34)}</div>
            <div style={{ ...T.title }}>Paid {PAYER}</div>
            <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 34, color: A.text }}>{money(me.total)}</div>
            <div style={{ ...T.bodySecondary, textAlign: 'center', padding: '0 20px' }}>{PAYER} sees it straight away. Left in your wallet: {money(WALLET_START - me.total)}.</div>
            <Btn title="Done" style={{ alignSelf: 'stretch', marginTop: 12 }} />
            <Confetti f={f - payAt - 6} />
          </div>
        )}
      </Sheet>
      <TapDot x={188} y={705} frame={f} at={payAt} />
    </div>
  );
}

function Confetti({ f }: { f: number }) {
  if (f < 0 || f > 50) return null;
  const cols = [LOOKS.sunset.a, LOOKS.sunset.b, A.success, A.warning, '#2E6BFF'];
  return (
    <>
      {Array.from({ length: 26 }, (_, i) => {
        const ang = (i / 26) * Math.PI * 2;
        const v = 120 + (i % 5) * 40;
        const x = 188 + Math.cos(ang) * v * (f / 30);
        const y = 70 + Math.sin(ang) * v * (f / 30) + 0.12 * f * f;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 8, height: 12, borderRadius: 2, background: cols[i % cols.length], transform: `rotate(${i * 40 + f * 12}deg)`, opacity: 1 - f / 50 }} />;
      })}
    </>
  );
}

// ------------------------------------------------------------------ The payer's view: who's paid (BillsTab dues)
export function DuesScreen({ f, paidAt }: { f: number; paidAt: number[] }) {
  const others = PEOPLE.filter((p) => p !== PAYER) as Person[];
  const paid = (i: number) => f >= paidAt[i];
  const owed = OWED_TO_PAYER - others.reduce((s, p, i) => s + (paid(i) ? SHARES[p].total : 0), 0);
  const all = owed === 0;
  return (
    <div style={{ position: 'absolute', inset: 0, background: A.bg, padding: `56px ${PAD}px 0` }}>
      <EventHeader />
      <Tabs items={['Details', 'Chat', 'Bills', 'Photos']} active={2} style={{ marginTop: 12 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}><span style={{ ...T.label }}>Your dues here</span><span style={{ ...T.caption, color: A.text, fontWeight: 600 }}>All your dues</span></div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Card style={{ flex: 1, padding: 14 }}><div style={{ ...T.label, fontSize: 11 }}>You owe</div><div style={{ ...T.stat, fontSize: 24 }}>$0.00</div></Card>
        <Card style={{ flex: 1, padding: 14 }}><div style={{ ...T.label, fontSize: 11 }}>Owed to you</div><div style={{ ...T.stat, fontSize: 24, color: all ? A.text : A.successText }}>{money(owed)}</div></Card>
      </div>
      <div style={{ ...T.label, marginTop: 18 }}>{BILL.description}</div>
      <Card style={{ marginTop: 8 }}>
        {others.map((p, i) => {
          const t = paid(i) ? pop(f, paidAt[i], 260, 14) : 0;
          return (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? `1px solid ${A.border}` : 'none' }}>
              <Av name={p} size={36} />
              <div style={{ flex: 1 }}><div style={{ ...T.value, fontWeight: 600 }}>{p}</div><div style={{ ...T.caption }}>{BILL.description}</div></div>
              <div style={{ ...T.money, marginRight: 8 }}>{money(SHARES[p].total)}</div>
              {paid(i) ? <div style={{ transform: `scale(${0.7 + 0.3 * t})` }}><DotChip label="Paid" dot={A.success} /></div> : <DotChip label="To pay" dot={A.pink} />}
            </div>
          );
        })}
      </Card>
      <Card style={{ marginTop: 12, padding: 16 }}>
        <div style={{ ...T.caption }}>Split by item</div>
        <div style={{ ...T.cardTitle }}>{BILL.description} · {money(BILL.totalCents)}</div>
        <div style={{ ...T.bodySecondary, fontSize: 14, color: all ? A.successText : A.textSecondary }}>{all ? 'Everyone has settled up.' : `${others.filter((_, i) => !paid(i)).length} still to pay you ${money(owed)}`}</div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Next: chip in first, pay as one
export function FundScreen({ f, inAt, cardAt, payAt }: { f: number; inAt: (i: number) => number; cardAt: number; payAt: number }) {
  const n = PEOPLE.filter((_, i) => f >= inAt(i)).length;
  const total = countUp(f, inAt(Math.max(0, n - 1)), 8, Math.max(0, n - 1) * TICKET_CENTS, n * TICKET_CENTS);
  const card = glide(f, cardAt, 16);
  const sheetT = glide(f, cardAt + 40, 12);
  const paid = f >= payAt + 6;
  return (
    <div style={{ position: 'absolute', inset: 0, background: A.bg, padding: `56px ${PAD}px 0` }}>
      <EventHeader />
      <div style={{ ...T.title, marginTop: 18 }}>Tickets <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400 }}>together</span></div>
      <div style={{ ...T.caption }}>Everyone chips in, then {PAYER} pays as one.</div>
      {/* The pot, which becomes the card */}
      <div style={{ position: 'relative', marginTop: 16, height: 210, borderRadius: AR.xl, overflow: 'hidden', background: card > 0 ? '#111114' : A.surface, backgroundImage: card > 0 ? WALLET_GRADIENT : 'none', boxShadow: shadow(10), transform: `rotate(${card * -2}deg) scale(${1 + 0.03 * Math.sin(card * Math.PI)})` }}>
        {card < 1 && (
          <div style={{ position: 'absolute', inset: 0, padding: 18, opacity: 1 - card }}>
            <div style={{ ...T.caption }}>Chipped in</div>
            <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 44, letterSpacing: -1.5, color: A.text }}>{money(total)}</div>
            <div style={{ ...T.caption }}>of {money(TICKETS_TOTAL)} · {n} of 4 in</div>
            <div style={{ height: 8, borderRadius: 4, background: A.surfaceAlt, marginTop: 14, overflow: 'hidden' }}><div style={{ width: `${(total / TICKETS_TOTAL) * 100}%`, height: '100%', background: A.success }} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {PEOPLE.map((p, i) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: f >= inAt(i) ? 1 : 0.3, transform: `scale(${f >= inAt(i) ? 0.85 + 0.15 * pop(f, inAt(i), 260, 14) : 0.85})` }}>
                  <Av name={p} size={28} /><span style={{ fontFamily: F.mono, fontSize: 12, color: A.text }}>{money(TICKET_CENTS).replace('.00', '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {card > 0 && (
          <div style={{ position: 'absolute', inset: 0, padding: 20, opacity: card, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 24 }}>wya group card</span>
              <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 22, letterSpacing: -1 }}>wya<span style={{ color: A.pink }}>.</span></span>
            </div>
            <div style={{ fontFamily: F.body, fontSize: 13, opacity: 0.7, marginTop: 34 }}>Balance</div>
            <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 38, letterSpacing: -1 }}>{money(TICKETS_TOTAL)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontFamily: F.mono, fontSize: 14, opacity: 0.85 }}><span>•••• 4521</span><span>{PAYER.toUpperCase()}</span></div>
          </div>
        )}
      </div>
      <Sheet t={sheetT} height={330}>
        {!paid ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: AS.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, overflow: 'hidden' }}><AppPoster title="" height={44} radius={11} /></div>
              <div><div style={{ ...T.cardTitle }}>{EVENT.title}</div><div style={{ ...T.caption }}>4 tickets · Sat 14 Nov</div></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `1px solid ${A.border}`, paddingTop: 12 }}>
              <span style={{ ...T.value, fontWeight: 600 }}>Total</span><span style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 30, color: A.text }}>{money(TICKETS_TOTAL)}</span>
            </div>
            <Card alt style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 34, borderRadius: 7, background: '#111114', backgroundImage: WALLET_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.body, fontWeight: 700, fontSize: 12, color: '#fff' }}>wya<span style={{ color: A.pink }}>.</span></div>
              <div style={{ flex: 1 }}><div style={{ ...T.value, fontWeight: 600 }}>Group card</div><div style={{ fontFamily: F.mono, fontSize: 12, color: A.textSecondary }}>•••• 4521</div></div>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: A.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.check('#fff', 13)}</div>
            </Card>
            <Btn title={`Pay ${money(TICKETS_TOTAL)}`} icon={Icon.lock()} pressed={f >= payAt && f < payAt + 5 ? 1 : 0} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: 30, background: A.success, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop(f, payAt + 6, 200, 13)})` }}>{Icon.check('#fff', 32)}</div>
            <div style={{ ...T.title }}>Tickets paid</div>
            <div style={{ ...T.bodySecondary }}>Nobody fronted a thing.</div>
            <Confetti f={f - payAt - 6} />
          </div>
        )}
      </Sheet>
      <TapDot x={188} y={735} frame={f} at={payAt} />
    </div>
  );
}
