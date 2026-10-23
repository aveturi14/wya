import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { countUp, glide, pop } from '../components/motion';
import { F } from '../styles/tokens';
import { BEAT, BAR, EVENT, RECEIPT, SUBTOTAL, SURCHARGE, TOTAL, SHARES, EVEN, ALEX_FOOD, ALEX_EXTRA, WALLET_BEFORE, TOPUP, money } from './data';
import { Av, Btn, Burst, Card, Chip, D, DotChip, Faces, Heading, I, In, Page, Phone, Poster, Scaled, Tap, TD, VIOLET } from './kit';

const S = 2.5; // app points → frame pixels
const COL = { position: 'absolute' as const, left: 70, top: 520 };

// ================================================================== 1. hook
const BUBBLES = [
  { who: 'Sam', t: 'wya??', x: 90, y: 560, at: 6 },
  { who: 'Priya', t: 'where ya at 👀', x: 470, y: 690, at: 22 },
  { who: 'Alex', t: 'here. where is everyone', x: 120, y: 880, at: 38 },
  { who: 'Jamie', t: 'wait is it still on?', x: 430, y: 1060, at: 54 },
  { who: 'Tom', t: "what's the address again", x: 150, y: 1230, at: 70 },
];
export function Hook() {
  const f = useCurrentFrame();
  const big = BAR * 2 - 6;
  const logo = BAR * 3;
  const blur = interpolate(f, [big - 4, big + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const out = interpolate(f, [logo - 6, logo], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Page glow={0.4}>
      <AbsoluteFill style={{ filter: `blur(${blur * 14}px)`, opacity: (1 - blur * 0.7) * (f < logo ? 1 : 0) }}>
        {BUBBLES.map((b) => (
          <In key={b.t} at={b.at} style={{ position: 'absolute', left: b.x, top: b.y }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
              <Av name={b.who} size={60} ring={D.bg} />
              <div>
                <div style={{ fontFamily: F.body, fontSize: 26, color: D.textSecondary, marginBottom: 6 }}>{b.who}</div>
                <div style={{ padding: '20px 30px', borderRadius: 36, background: D.surfaceAlt, color: D.text, fontFamily: F.body, fontWeight: 500, fontSize: 44 }}>{b.t}</div>
              </div>
            </div>
          </In>
        ))}
      </AbsoluteFill>
      {f >= big && f < logo && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
          <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 64, letterSpacing: -2.6, color: D.text, marginBottom: 6, opacity: glide(f, big, 6) }}>Every group chat <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400, color: D.accent, letterSpacing: -0.5 }}>asks it.</span></div>
          <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 150, letterSpacing: -6.8, lineHeight: 1.04, color: D.text, transform: `scale(${0.85 + 0.15 * pop(f, big, 200, 13)})` }}>
            Where you <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400, color: D.accent, letterSpacing: -2 }}>at?</span>
          </div>
        </AbsoluteFill>
      )}
      {f >= logo && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * pop(f, logo, 200, 12)})`, fontFamily: F.body, fontWeight: 700, fontSize: 260, letterSpacing: -14, color: D.text, lineHeight: 1 }}>wya<span style={{ color: D.pink }}>.</span></div>
          <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 84, color: D.accent, opacity: glide(f, logo + 8, 8) }}>where you at?</div>
        </AbsoluteFill>
      )}
    </Page>
  );
}

// ================================================================== 2. small plans fall apart
function Mini({ title, children, at }: { title: string; children: React.ReactNode; at: number }) {
  return (
    <In at={at} style={{ width: 455 }}>
      <Card style={{ padding: 26, height: 455, boxSizing: 'border-box' }}>
        <div style={{ ...TD.cardTitle, fontSize: 38, lineHeight: 1.1, marginBottom: 18 }}>{title}</div>
        {children}
      </Card>
    </In>
  );
}
export function Problem() {
  const f = useCurrentFrame();
  const big = { fontFamily: F.body, fontSize: 30, color: D.text };
  return (
    <Page>
      <Heading main="Small plans fall apart" accent="in the chat." top={1290} />
      <div style={{ position: 'absolute', left: 70, top: 250, display: 'flex', flexWrap: 'wrap', gap: 30, width: 940 }}>
        <Mini title="Who's coming?" at={6}>
          {['maybe', 'prob', 'depends on work', 'who else is going?'].map((t, i) => <In key={t} at={10 + i * 4}><Chip label={t} style={{ fontSize: 30, minHeight: 60, padding: '0 20px', marginBottom: 12 }} /></In>)}
        </Mini>
        <Mini title="Cooked for 30" at={BEAT * 2}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            {Array.from({ length: 30 }, (_, i) => <div key={i} style={{ width: 44, height: 44, borderRadius: 22, background: f > BEAT * 2 + 20 && i >= 10 ? D.surfaceAlt : D.success, transition: 'none' }} />)}
          </div>
          <div style={{ ...big, marginTop: 16 }}><b>10</b> showed up.</div>
        </Mini>
        <Mini title="Where is it?" at={BEAT * 4}>
          <div style={{ padding: '14px 18px', borderRadius: 20, background: '#7B4DFF', color: '#fff', fontFamily: F.body, fontSize: 30, width: 340 }}>ugh, someone resend the address</div>
          <div style={{ padding: '10px 18px', borderRadius: 20, background: D.surfaceAlt, color: D.text, fontFamily: F.body, fontSize: 30, width: 'fit-content', margin: '14px 0 0 auto' }}>scroll up</div>
          <div style={{ fontFamily: F.body, fontSize: 30, fontWeight: 600, color: D.pink, marginTop: 40 }}>↓ 23 new messages</div>
        </Mini>
        <Mini title="The photos?" at={BEAT * 6}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {['#FF7A3D', '#2E6BFF', '#1FB57A', '#E040A0', '#FFC46B', '#7B4DFF'].map((c, i) => <div key={c} style={{ height: 110, borderRadius: 16, background: `linear-gradient(160deg, ${c}, #111)`, transform: `rotate(${(i % 3 - 1) * 3}deg)` }} />)}
          </div>
          <div style={{ ...big, marginTop: 16 }}>On <b>six</b> different phones.</div>
        </Mini>
      </div>
    </Page>
  );
}

// ================================================================== 3. home
export function Home() {
  const f = useCurrentFrame();
  return (
    <Page>
      <Heading main="Every plan," accent="one place." enter="left" />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 470 }}>
        <div style={{ transform: `translateY(${(1 - pop(f, 0, 120, 16)) * 400}px)` }}>
          <Phone width={600}>
            <div style={{ padding: '58px 16px 0' }}>
              <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 28, letterSpacing: -1.4, color: D.text }}>wya<span style={{ color: D.pink }}>.</span></div>
              <div style={{ ...TD.caption, color: D.text, marginTop: 16 }}>Hey Maya</div>
              <div style={{ ...TD.title, fontSize: 30 }}>Your <span style={{ ...TD.accent }}>week</span></div>
              <In at={8} style={{ marginTop: 12 }}><Poster w={343} h={190} stickers={[EVENT.when, '4 going']} /></In>
              <In at={20} style={{ marginTop: 12 }}>
                <Card style={{ padding: 4 }}>
                  {[['Pick a time', 'Game night · 3 people voted', 'Vote'], ['Are you coming?', 'Beach day · Jamie invited you', 'Answer'], ['Add your photos', "Maya's 23rd · album open", 'Add']].map(([a, b, c], i) => (
                    <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? `1px solid ${D.border}` : 'none' }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: D.pink }} />
                      <div style={{ flex: 1 }}><div style={{ ...TD.value, fontWeight: 600, fontSize: 14 }}>{a}</div><div style={{ ...TD.caption, fontSize: 12 }}>{b}</div></div>
                      <Chip label={c} />
                    </div>
                  ))}
                </Card>
              </In>
              <In at={30} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Poster w={160} h={84} title="Beach day" line="" foot="SUN 22 NOV" footRight="" titleSize={18} look={{ a: '#2E6BFF', b: '#5BE1E6', ink: '#fff' }} radius={14} />
                <Poster w={160} h={84} title="Game night" line="" foot="FRI 27 NOV" footRight="" titleSize={18} look={{ a: '#C6F432', b: '#1FB57A', ink: '#101012' }} radius={14} />
              </In>
            </div>
          </Phone>
        </div>
      </AbsoluteFill>
    </Page>
  );
}

// ================================================================== 4. create
const NAME = "Maya's 23rd";
export function Create() {
  const f = useCurrentFrame();
  const typed = NAME.slice(0, Math.max(0, Math.min(NAME.length, Math.floor((f - 10) / 2.2))));
  const looks = [{ a: '#1C1F4A', b: '#7A5CFF', ink: '#fff' }, { a: '#2E6BFF', b: '#5BE1E6', ink: '#fff' }, VIOLET];
  const lookIdx = f < 46 ? 0 : f < 64 ? 1 : 2;
  const where = f >= 80;
  const ready = f >= BAR * 2;
  return (
    <Page>
      <Heading main="Start one in" accent="seconds." align="right" enter="right" />
      <div style={COL}>
        <Scaled s={S}>
          <Card style={{ padding: 14, width: 376 }}>
            <div style={{ ...TD.heading }}>New event</div>
            <div style={{ ...TD.label, fontSize: 10, marginTop: 10 }}>Name</div>
            <div style={{ ...TD.value, padding: '8px 10px', borderRadius: 12, background: D.surfaceAlt, marginTop: 4, minHeight: 21 }}>{typed}<span style={{ opacity: f % 16 < 8 && typed.length < NAME.length ? 1 : 0 }}>|</span></div>
            <div style={{ ...TD.label, fontSize: 10, marginTop: 10 }}>Look</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {['#FF5A4E', '#7B4DFF', '#2E6BFF', '#C6F432', '#FFC46B', '#FF7A3D', '#1C1F4A'].map((c, i) => (
                <div key={c} style={{ width: 26, height: 26, borderRadius: 13, background: c, boxShadow: (lookIdx === 2 && i === 1) || (lookIdx === 1 && i === 2) || (lookIdx === 0 && i === 6) ? `0 0 0 2px ${D.bg}, 0 0 0 4px ${D.text}` : 'none' }} />
              ))}
            </div>
            <div style={{ ...TD.label, fontSize: 10, marginTop: 10 }}>Where</div>
            <div style={{ ...TD.value, padding: '8px 10px', borderRadius: 12, background: D.surfaceAlt, marginTop: 4, color: where ? D.text : D.textMuted }}>{where ? `${EVENT.place}, Haymarket` : 'Add a place'}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><Btn title="Set a time" size="sm" /><Btn title="Leave it open" size="sm" variant="soft" /></div>
          </Card>
        </Scaled>
      </div>
      <div style={{ position: 'absolute', left: 250, top: 1265, transform: `rotate(-3deg) scale(${0.9 + 0.1 * pop(f, 6, 150, 14)})` }}>
        <Poster w={570} h={250} title={typed || 'Your event'} titleSize={typed.length > 8 ? 60 : 72} look={looks[lookIdx]} foot="SAT 14 NOV · 7PM" footRight={where ? 'GOLDEN LANTERN' : 'SOMEWHERE'} stickers={ready ? ['✓ Invite ready'] : []} radius={34} />
      </div>
    </Page>
  );
}

// ================================================================== 5. leave it open
export function Open() {
  const f = useCurrentFrame();
  const rows = [{ t: 'Fri 13 Nov · 7:00 PM', who: ['Alex', 'Sam'] }, { t: 'Sat 14 Nov · 7:00 PM', who: ['Alex', 'Jamie', 'Sam', 'Tom'] }, { t: 'Sun 15 Nov · 12:30 PM', who: ['Jamie'] }];
  const locked = f >= BAR + 20;
  return (
    <Page>
      <Heading main="Not sure when? Leave it" accent="open." size={84} top={1110} enter="zoom" />
      <div style={{ ...COL, top: 250 }}>
        <Scaled s={S}>
          <Card style={{ padding: 14, width: 376 }}>
            <div style={{ ...TD.heading }}>Find a time</div>
            <div style={{ ...TD.caption, marginBottom: 8 }}>Mark every time you could make. The host picks one.</div>
            {rows.map((r, i) => {
              const best = i === 1 && f >= 40;
              return (
                <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px', borderRadius: 12, marginTop: 6, background: best ? 'rgba(52,199,123,0.12)' : D.surfaceAlt, border: `1px solid ${best ? D.success : 'transparent'}` }}>
                  <div style={{ flex: 1 }}><div style={{ ...TD.value, fontWeight: 600, fontSize: 14 }}>{r.t}</div><div style={{ ...TD.caption, fontSize: 11 }}>{r.who.filter((_, j) => f >= 8 + j * 7 + i * 3).length} can make it</div></div>
                  {best && <DotChip label="Best so far" dot={D.success} />}
                  <Faces names={r.who.filter((_, j) => f >= 8 + j * 7 + i * 3)} size={20} />
                </div>
              );
            })}
            <Btn title={locked ? <>{I.check(D.bg)} Locked in: Sat 14 Nov, 7 PM</> : 'Lock it in'} variant={locked ? 'success' : 'primary'} style={{ marginTop: 12 }} pressed={f >= BAR + 16 && f < BAR + 20 ? 1 : 0} />
          </Card>
        </Scaled>
      </div>
    </Page>
  );
}

// ================================================================== 6. one link
export function Link() {
  const f = useCurrentFrame();
  const join = BAR + 30;
  const joined = f >= join + 4;
  return (
    <Page glow={0.45}>
      <Heading main="One link." accent="Everyone's in." />
      <div style={{ ...COL, top: 480 }}>
        <Scaled s={2.2}>
          <In at={4}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><Chip label="WhatsApp" on style={{ background: '#25D366', color: '#062' }} /><Chip label="Messages" /><Chip label="Copy link" /></div>
            <div style={{ width: 250, borderRadius: 14, background: '#1F2C24', padding: 6, border: '1px solid #2A3A30' }}>
              <Poster w={238} h={92} titleSize={24} stickers={[]} radius={10} />
              <div style={{ ...TD.value, fontSize: 12, fontWeight: 600, marginTop: 6, padding: '0 4px' }}>Maya invited you to Maya's 23rd</div>
              <div style={{ ...TD.body, fontSize: 12, padding: '2px 4px 4px' }}>dinner for my 23rd, you in? 🥟</div>
            </div>
          </In>
        </Scaled>
      </div>
      <div style={{ position: 'absolute', left: 422, top: 930 }}>
        <Scaled s={2.1}>
          <In at={BAR}>
            <Card style={{ width: 280, padding: 10, background: '#F5F5F7', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><span style={{ ...TD.label, fontSize: 9, color: '#55555D' }}>You're invited</span><span style={{ fontFamily: F.body, fontSize: 10, fontWeight: 600, color: D.bg, padding: '2px 7px', borderRadius: 999, background: '#fff', border: '1px solid #ddd' }}>Hosted by Maya</span></div>
              <Poster w={258} h={100} titleSize={26} radius={12} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}><Faces names={['Jamie', 'Sam', 'Alex']} size={18} /><span style={{ fontFamily: F.body, fontSize: 11, color: '#55555D' }}>Jamie, Sam and Alex are going</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '7px 9px', borderRadius: 10, background: '#EDEDF0', fontFamily: F.body, fontSize: 11, color: D.bg }}>
                {joined ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={D.bg} strokeWidth="2"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /></svg><b>Golden Lantern</b> · {EVENT.address}</> : <>🔒 The address shows once you're in</>}
              </div>
              <Btn title={joined ? <>{I.check(D.bg)} You're on the guest list</> : "Join Maya's 23rd"} variant={joined ? 'success' : 'primary'} style={{ marginTop: 8, background: joined ? D.success : D.bg, color: joined ? D.bg : '#fff' }} pressed={f >= join && f < join + 4 ? 1 : 0} />
            </Card>
          </In>
        </Scaled>
      </div>
    </Page>
  );
}

// ================================================================== 7. I'm in means I'm in
export function Pledge() {
  const f = useCurrentFrame();
  const tap = 44;
  const yes = f >= tap;
  return (
    <Page>
      <Heading main="means I'm in." accent="I'm in" accentFirst hold={20} align="center" />
      <In at={26} style={{ ...COL, top: 480 }}>
        <Scaled s={S}>
          <Card style={{ padding: 14, width: 376 }}>
            <div style={{ ...TD.heading }}>Are you coming?</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Btn title={yes ? "You're in" : "I'm in"} style={{ flex: 1.3, background: `linear-gradient(135deg, ${VIOLET.a}, ${VIOLET.b})`, color: '#fff' }} pressed={f >= tap && f < tap + 4 ? 1 : 0} />
              <Btn title="Maybe" variant="soft" style={{ flex: 1 }} />
              <Btn title="Can't go" variant="soft" style={{ flex: 1 }} />
            </div>
            <div style={{ ...TD.caption, marginTop: 10, padding: '8px 10px', borderRadius: 10, background: yes ? 'rgba(52,199,123,0.14)' : D.surfaceAlt, color: yes ? D.success : D.textSecondary }}>
              {yes ? <><b>You've pledged $5.00.</b><br />Free to cancel until Fri 13 Nov, 7 PM.</> : <>Maya added a $5 no-show fee, just for fun.<br />Turn up, and you pay nothing.</>}
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, width: 376 }}>
            <In at={BAR + 6} style={{ flex: 1 }}><Card style={{ padding: 12, minHeight: 136, boxSizing: 'border-box' }}><DotChip label="Showed up" dot={D.success} /><div style={{ fontFamily: F.mono, fontSize: 30, color: D.text, marginTop: 6 }}>$0</div><div style={{ ...TD.caption, fontSize: 12 }}>Nothing happens. Your record says you came.</div></Card></In>
            <In at={BAR * 2} style={{ flex: 1 }}><Card style={{ padding: 12, minHeight: 136, boxSizing: 'border-box' }}><DotChip label="Flaked" dot={D.pink} /><div style={{ fontFamily: F.mono, fontSize: 30, color: D.text, marginTop: 6 }}>$5.00</div><div style={{ ...TD.caption, fontSize: 12 }}>Paid to Maya. A real excuse? Maya can waive it.</div></Card></In>
          </div>
        </Scaled>
      </In>
    </Page>
  );
}

// ================================================================== 8. know who's coming
export function Host() {
  const f = useCurrentFrame();
  const remind = 30;
  const after = 60;
  const rows: [string, string, string][] = [
    ['Alex', 'In', D.success], ['Jamie', 'In', D.success],
    ['Sam', f >= after ? 'In' : 'Waiting', f >= after ? D.success : D.textMuted],
    ['Tom', f >= after + 12 ? "Can't go" : 'Maybe', f >= after + 12 ? D.danger : D.warning],
    ['Priya', "Can't go", D.danger],
  ];
  const going = rows.filter((r) => r[1] === 'In').length + 1;
  return (
    <Page>
      <Heading main="Know who's" accent="actually coming." align="right" enter="right" />
      <div style={{ ...COL, top: 500 }}>
        <Scaled s={S}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>{['Invite', 'Remind', 'Who came', 'Edit'].map((t) => <Btn key={t} title={t} variant="soft" size="sm" style={{ flex: 1, background: t === 'Remind' && f >= remind && f < remind + 8 ? D.text : D.surfaceAlt, color: t === 'Remind' && f >= remind && f < remind + 8 ? D.bg : D.text }} />)}</div>
          <Card style={{ padding: 12, width: 376 }}>
            <div style={{ ...TD.cardTitle }}>5 invited</div>
            <div style={{ height: 6, borderRadius: 3, background: D.surfaceAlt, marginTop: 8, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${((going - 1) / 5) * 100}%`, background: D.success }} /><div style={{ width: `${(rows.filter((r) => r[1] === 'Maybe').length / 5) * 100}%`, background: D.warning }} />
            </div>
            {rows.map(([n, s, c], i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${D.border}` : 'none', marginTop: i ? 0 : 8 }}>
                <Av name={n} size={26} /><div style={{ flex: 1, ...TD.value, fontWeight: 600, fontSize: 14 }}>{n}</div><DotChip label={s} dot={c} />
              </div>
            ))}
          </Card>
        </Scaled>
      </div>
      {f >= remind + 4 && f < after + 30 && (
        <div style={{ position: 'absolute', left: 90, top: 1310, width: 900, opacity: Math.min(1, pop(f, remind + 4, 200, 15) * 1.5), transform: `translateY(${(1 - pop(f, remind + 4, 200, 15)) * 160}px)` }}>
          <div style={{ display: 'flex', gap: 22, alignItems: 'center', padding: 26, borderRadius: 34, background: 'rgba(40,40,46,0.96)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 70, height: 70, borderRadius: 18, background: D.text, color: D.bg, fontFamily: F.body, fontWeight: 700, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>w<span style={{ color: D.pink }}>.</span></div>
            <div style={{ fontFamily: F.body, fontSize: 30, color: D.text }}><b>Are you coming to Maya's 23rd?</b><br /><span style={{ color: D.textSecondary }}>Decide by Fri 13 Nov, 7 PM.</span></div>
          </div>
        </div>
      )}
    </Page>
  );
}

// ================================================================== 9. the chat lives with the event
export function Chat() {
  const f = useCurrentFrame();
  const cmds = ['/poll', '/plan', '/here', '/remind', '/bill'];
  const active = f < BAR ? 0 : f < BAR * 2 ? 1 : 2;
  const votes = [Math.min(3, Math.floor(Math.max(0, f - 14) / 8)), Math.min(1, Math.floor(Math.max(0, f - 30) / 8)), 0];
  return (
    <Page>
      <Heading main="The chat lives" accent="with the event." top={1325} />
      <div style={{ ...COL, left: 89, top: 250 }}>
        <Scaled s={2.4}>
          <div style={{ width: 376, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <In at={4}>
              <Card style={{ padding: 12 }}>
                <div style={{ ...TD.caption, fontSize: 11 }}>Jamie started a poll</div>
                <div style={{ ...TD.cardTitle, marginBottom: 6 }}>Where after dinner?</div>
                {['Karaoke', 'Dessert bar', 'Call it a night'].map((o, i) => (
                  <div key={o} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 10, marginTop: 4, overflow: 'hidden', background: D.surfaceAlt }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(votes[i] / 4) * 100}%`, background: i === 0 ? 'rgba(201,168,255,0.35)' : 'rgba(255,255,255,0.08)' }} />
                    <span style={{ ...TD.value, fontSize: 13, position: 'relative' }}>{o}</span><span style={{ ...TD.money, fontSize: 13, position: 'relative' }}>{votes[i]}</span>
                  </div>
                ))}
              </Card>
            </In>
            <div style={{ display: 'flex', gap: 10 }}>
              <In at={BAR} style={{ flex: 1 }}>
                <Card style={{ padding: 12 }}>
                  <div style={{ ...TD.cardTitle, marginBottom: 6 }}>The plan</div>
                  {[['7:00', 'Dinner', 'Golden Lantern'], ['9:30', 'Karaoke', 'Booth for 4'], ['11:30', 'Late snacks', 'Wherever']].map(([t, a, b]) => (
                    <div key={t} style={{ display: 'flex', gap: 8, padding: '4px 0' }}><span style={{ ...TD.money, fontSize: 12, width: 34 }}>{t}</span><div><div style={{ ...TD.value, fontSize: 13, fontWeight: 600 }}>{a}</div><div style={{ ...TD.caption, fontSize: 11 }}>{b}</div></div></div>
                  ))}
                </Card>
              </In>
              <In at={BAR * 2} style={{ flex: 1 }}>
                <Card style={{ padding: 12 }}>
                  <div style={{ ...TD.cardTitle, marginBottom: 6 }}>Who's here</div>
                  {[['Alex', '6:58'], ['Jamie', '7:02'], ['Sam', '7:05']].map(([n, t], i) => (
                    <In key={n} at={BAR * 2 + 8 + i * 8}><div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}><Av name={n} size={20} /><span style={{ ...TD.value, fontSize: 12, flex: 1 }}>{n} is here</span><span style={{ ...TD.caption, fontSize: 10, color: D.success }}>{t} PM</span></div></In>
                  ))}
                </Card>
              </In>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              {cmds.map((c, i) => <Chip key={c} label={c} on={i === active} style={{ minHeight: 28, padding: '0 11px', fontSize: 12 }} />)}
            </div>
          </div>
        </Scaled>
      </div>
    </Page>
  );
}

// ================================================================== 10. album
const PHOTOS: [string, string][] = [['IMG_6195', 'Sam'], ['IMG_8942', 'Maya'], ['IMG_5703', 'Jamie'], ['IMG_6043', 'Alex'], ['IMG_3939', 'Maya'], ['IMG_6050', 'Jamie']];
export function Album() {
  const f = useCurrentFrame();
  const n = countUp(f, 4, 60, 0, 48);
  return (
    <Page glow={0.5}>
      <Heading main="One album." accent="Everyone's photos." align="center" enter="zoom" />
      <div style={{ position: 'absolute', left: 70, right: 70, top: 470, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <Faces names={['Maya', 'Alex', 'Jamie', 'Sam']} size={52} /><span style={{ fontFamily: F.body, fontSize: 34, color: D.text }}><b>{n} photos</b> <span style={{ color: D.textSecondary }}>from the 4 who came</span></span>
      </div>
      <div style={{ position: 'absolute', left: 70, top: 560, width: 940, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {PHOTOS.map(([src, who], i) => (
          <In key={src} at={6 + i * 6} from={80}>
            <div style={{ position: 'relative', height: 400, borderRadius: 22, overflow: 'hidden', background: D.surface, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
              <Img src={staticFile(`img/album/${src}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.12 - 0.12 * Math.min(1, Math.max(0, f - 6 - i * 6) / 90)})` }} />
              <div style={{ position: 'absolute', right: 10, bottom: 10 }}><Av name={who} size={40} ring="rgba(0,0,0,0.6)" /></div>
              {i === PHOTOS.length - 1 && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,11,13,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.body, fontWeight: 700, fontSize: 64, color: '#fff', opacity: Math.min(1, Math.max(0, (f - 50) / 10)) }}>+{Math.max(0, n - 6)}</div>
              )}
            </div>
          </In>
        ))}
      </div>
    </Page>
  );
}

// ================================================================== 11. then the bill came
export function Bill() {
  const f = useCurrentFrame();
  const msgs = [['Sam', 'who had the wine 🍷'], ['Jamie', 'I literally only had tofu'], ['Alex', 'just split it 4 ways?'], ['Jamie', "that's $48 for tofu 😩"], ['Sam', 'someone make a spreadsheet']];
  const phase2 = BAR + 40;
  return (
    <Page glow={0.4}>
      <Heading main="Then the bill" accent="came." hold={22} size={100} align="center" />
      {f < phase2 && (
        <>
          <div style={{ position: 'absolute', left: 70, top: 500, transform: 'rotate(-4deg)' }}>
            <In at={28}><div style={{ width: 380, padding: '22px 26px', borderRadius: 10, background: '#FBFAF7', fontFamily: F.mono, color: '#222', fontSize: 22, boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: 15, opacity: 0.6 }}>GOLDEN LANTERN · TABLE 7</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}><span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 26 }}>Total</span><span style={{ fontSize: 46, fontWeight: 500 }}>{money(TOTAL)}</span></div>
              <div style={{ fontSize: 15, opacity: 0.6, marginTop: 6 }}>Paid by Maya · card ending 4417</div>
            </div></In>
          </div>
          <div style={{ position: 'absolute', left: 330, top: 820, width: 680 }}>
            {msgs.map(([w, t], i) => (
              <In key={t} at={34 + i * 8} style={{ display: 'flex', flexDirection: w === 'Alex' ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-end', marginTop: 14 }}>
                <Av name={w} size={50} ring={D.bg} />
                <div style={{ padding: '16px 24px', borderRadius: 30, background: w === 'Alex' ? '#7B4DFF' : D.surfaceAlt, color: D.text, fontFamily: F.body, fontSize: 36 }}>{t}</div>
              </In>
            ))}
          </div>
        </>
      )}
      {f >= phase2 && (
        <div style={{ position: 'absolute', left: 70, top: 500, width: 940, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <In at={phase2}><Card style={{ padding: 26 }}><div style={{ ...TD.cardTitle, fontSize: 38 }}>Split it evenly?</div><div style={{ fontFamily: F.mono, fontSize: 30, color: D.textSecondary, marginTop: 6 }}>{money(TOTAL)} ÷ 4</div><div style={{ fontFamily: F.mono, fontSize: 64, color: D.text }}>{money(EVEN)}</div><div style={{ fontFamily: F.body, fontSize: 28, color: '#FFB3C9', background: 'rgba(255,46,122,0.14)', padding: '10px 16px', borderRadius: 14, marginTop: 8 }}>Jamie had tofu and a lemonade. <b>{money(SHARES.Jamie)}</b> worth.</div></Card></In>
          <div style={{ display: 'flex', gap: 22 }}>
            <In at={phase2 + 12} style={{ flex: 1 }}><Card style={{ padding: 26, height: 340, boxSizing: 'border-box' }}><div style={{ ...TD.cardTitle, fontSize: 36 }}>Work it out?</div><div style={{ fontFamily: F.mono, fontSize: 26, color: D.textSecondary, marginTop: 10, lineHeight: 1.5 }}>26 ÷ 2 + 24<br />+ 54 × ⅔ + 8<br />+ 10% surcharge…<br /><span style={{ color: D.pink }}>¯\_(ツ)_/¯</span></div></Card></In>
            <In at={phase2 + 24} style={{ flex: 1 }}><Card style={{ padding: 26, height: 340, boxSizing: 'border-box' }}><div style={{ ...TD.cardTitle, fontSize: 36 }}>Chase people?</div><div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 20, background: '#7B4DFF', fontFamily: F.body, fontSize: 24, color: '#fff' }}>hey Sam, the {money(SHARES.Sam)} from Saturday</div><div style={{ marginTop: 10, marginLeft: 'auto', width: 'fit-content', padding: '10px 16px', borderRadius: 20, background: '#7B4DFF', fontFamily: F.body, fontSize: 24, color: '#fff' }}>Sam?</div><div style={{ fontFamily: F.body, fontSize: 20, color: D.textSecondary, textAlign: 'right', marginTop: 6 }}>Seen 3 days ago</div></Card></In>
          </div>
          <In at={phase2 + 40}><div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 72, color: D.accent, marginTop: 30 }}>Nobody wants that job.</div></In>
        </div>
      )}
    </Page>
  );
}

// ================================================================== 12. snap it
export function Snap() {
  const f = useCurrentFrame();
  const scan = interpolate(f, [14, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shown = Math.floor(scan * RECEIPT.length);
  const ok = f >= 72;
  return (
    <Page>
      <Heading main="Snap it." accent="wya reads it." top={1410} enter="left" />
      <div style={{ position: 'absolute', left: 60, top: 250, width: 470, padding: '24px 26px', background: '#FBFAF7', fontFamily: F.mono, color: '#222', fontSize: 22, transform: 'rotate(-3deg)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 500 }}>GOLDEN LANTERN</div>
        <div style={{ textAlign: 'center', fontSize: 14, opacity: 0.6, marginBottom: 12 }}>HAYMARKET NSW · TABLE 7</div>
        {RECEIPT.map((r, i) => <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', background: i < shown ? 'rgba(255,46,122,0.12)' : 'transparent' }}><span>{r.name.replace(' (8)', '')}{r.qty > 1 ? ` ×${r.qty}` : ''}</span><span>{(r.cents / 100).toFixed(2)}</span></div>)}
        <div style={{ borderTop: '1px dashed #999', marginTop: 8, paddingTop: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Weekend 10%</span><span>{(SURCHARGE / 100).toFixed(2)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}><span>TOTAL</span><span>{(TOTAL / 100).toFixed(2)}</span></div></div>
        {scan > 0 && scan < 1 && <div style={{ position: 'absolute', left: -10, right: -10, top: 70 + scan * 470, height: 4, background: D.pink, boxShadow: '0 0 24px 6px rgba(255,46,122,0.55)' }} />}
      </div>
      <div style={{ position: 'absolute', left: 520, top: 620 }}>
        <Scaled s={2.0}>
          <In at={20}>
            <Card style={{ padding: 12, width: 250 }}>
              <div style={{ ...TD.cardTitle }}>Split the bill</div>
              <div style={{ ...TD.caption, fontSize: 11, marginBottom: 6 }}>Maya's 23rd · paid by Maya</div>
              {RECEIPT.slice(0, shown).map((r) => <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2.5px 0', ...TD.value, fontSize: 11.5 }}><span>{r.name}{r.qty > 1 ? ` ×${r.qty}` : ''}</span><span style={{ fontFamily: F.mono }}>{money(r.cents)}</span></div>)}
              {ok && <div style={{ marginTop: 8, padding: '7px 9px', borderRadius: 9, background: 'rgba(52,199,123,0.14)', color: D.success, fontFamily: F.body, fontSize: 10.5, fontWeight: 600 }}>✓ Read 8 items. They add up to the {money(TOTAL)} total.</div>}
              {ok && <Btn title="Send to the 3 others who came" size="sm" style={{ marginTop: 8 }} />}
            </Card>
          </In>
        </Scaled>
      </div>
    </Page>
  );
}

// ================================================================== 13. tick what you had
export function Tick() {
  const f = useCurrentFrame();
  const mine = [0, 1]; // Alex: dumplings (shared with Maya) and the crispy chicken
  const tickAt = (i: number) => 26 + i * BEAT;
  const units = BAR + 30;
  const share = BAR * 2 + 10;
  const claimed = 2600 + 2400 + (f >= units ? 5400 : 0) + (f >= tickAt(1) + 20 ? 1900 + 2200 + 1600 + 800 + 800 : 0);
  return (
    <Page>
      <Heading main="Tick what you" accent="actually had." enter="left" />
      {f < units - 4 && <In at={2} style={{ position: 'absolute', left: 70, top: 470, width: 940 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', padding: 20, borderRadius: 28, background: 'rgba(40,40,46,0.96)' }}>
          <div style={{ width: 58, height: 58, borderRadius: 15, background: D.text, color: D.bg, fontFamily: F.body, fontWeight: 700, fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>w<span style={{ color: D.pink }}>.</span></div>
          <div style={{ fontFamily: F.body, fontSize: 28, color: D.text }}><b>Maya</b> shared the bill for Maya's 23rd ({money(TOTAL)}). Pick what you had.</div>
        </div>
      </In>}
      <div style={{ ...COL, left: 183, top: 685 }}>
        <Scaled s={1.9}>
          <Card style={{ padding: 12, width: 376 }}>
            <div style={{ ...TD.title, fontSize: 22 }}>What did you have, <span style={TD.accent}>Alex?</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.body, fontWeight: 700, fontSize: 12, color: D.text, marginTop: 6 }}><span>{money(Math.min(claimed, SUBTOTAL))} of {money(SUBTOTAL)} claimed</span>{claimed >= SUBTOTAL && <span style={{ color: D.success }}>All claimed</span>}</div>
            <div style={{ height: 5, borderRadius: 3, background: D.surfaceAlt, margin: '5px 0 6px', overflow: 'hidden' }}><div style={{ width: `${Math.min(1, claimed / SUBTOTAL) * 100}%`, height: '100%', background: claimed >= SUBTOTAL ? D.success : D.text }} /></div>
            {RECEIPT.map((r, i) => {
              const on = mine.includes(i) && f >= tickAt(mine.indexOf(i));
              const others = f >= tickAt(1) + 20 || (i === 5 && f >= units);
              const faces = mine.includes(i) ? (on ? r.who : r.who.filter((w) => w !== 'Alex')) : others ? r.who : [];
              return (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', borderTop: i ? `1px solid ${D.border}` : 'none', background: i === 5 && f >= units - 4 && f < units + 30 ? 'rgba(201,168,255,0.10)' : 'transparent' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? D.text : D.lineStrong}`, background: on ? D.text : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{on && I.check(D.bg, 12)}</div>
                  <div style={{ flex: 1 }}><div style={{ ...TD.value, fontSize: 12.5 }}>{r.name}{r.qty > 1 ? ` ×${r.qty}` : ''}</div>{faces.length > 0 && (i === 0 || i === 5) && <div style={{ ...TD.caption, fontSize: 10 }}>{r.caption}</div>}</div>
                  <Faces names={faces} size={17} />
                  <span style={{ ...TD.money, fontSize: 12, width: 50, textAlign: 'right' }}>{money(r.cents)}</span>
                </div>
              );
            })}
            <div style={{ ...TD.caption, fontSize: 10.5, marginTop: 4 }}>Weekend surcharge 10% · shared by what each person ordered · {money(SURCHARGE)}</div>
          </Card>
        </Scaled>
      </div>
      {f >= units - 4 && f < share && (
        <div style={{ position: 'absolute', left: 70, top: 450 }}>
          <Scaled s={S}>
            <In at={units - 4}><Card style={{ padding: 10, width: 376, border: `1px solid ${D.accent}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', ...TD.value, fontWeight: 600, fontSize: 12.5 }}><span>House red ×3</span><span style={{ fontFamily: F.mono }}>$54.00</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}><span style={{ ...TD.caption, fontSize: 10.5 }}>Sam had</span><Chip label="Shared" style={{ minHeight: 22, fontSize: 10 }} /><Chip label="1" style={{ minHeight: 22, fontSize: 10 }} /><Chip label="2" on={f >= units} style={{ minHeight: 22, fontSize: 10 }} /><Chip label="3" style={{ minHeight: 22, fontSize: 10, opacity: 0.4 }} /></div>
              <div style={{ ...TD.caption, fontSize: 10, marginTop: 4 }}>$36.00 for Sam's 2 · Maya had 1</div>
            </Card></In>
          </Scaled>
        </div>
      )}
      {f >= share && (
        <div style={{ position: 'absolute', left: 70, top: 450 }}>
          <Scaled s={S}>
            <In at={share}><Card style={{ padding: 10, width: 376, border: `1px solid ${D.success}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', ...TD.cardTitle, fontSize: 14 }}><span>Your share</span><span style={{ fontFamily: F.mono, fontWeight: 500 }}>{money(SHARES.Alex)}</span></div>
              <div style={{ ...TD.caption, fontSize: 10 }}>{money(ALEX_FOOD)} food + {money(ALEX_EXTRA)} of the surcharge</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, ...TD.value, fontSize: 11, color: D.success }}>{I.check(D.success, 12)} Confirmed</div>
            </Card></In>
          </Scaled>
        </div>
      )}
    </Page>
  );
}

// ================================================================== 14. it always adds up
export function Adds() {
  const f = useCurrentFrame();
  const lock = 16;
  const rows: [string, number, string][] = [['Maya', SHARES.Maya, 'Paid the bill'], ['Alex', SHARES.Alex, 'Owes Maya'], ['Jamie', SHARES.Jamie, 'Owes Maya'], ['Sam', SHARES.Sam, 'Owes Maya']];
  return (
    <Page>
      <Heading main="It always" accent="adds up." top={1130} size={120} enter="zoom" />
      <div style={{ ...COL, top: 300 }}>
        <Scaled s={S}>
          <Btn title={<>{I.lock()} Lock the split</>} style={{ width: 'fit-content', opacity: f >= lock + 6 ? 0.35 : 1 }} pressed={f >= lock && f < lock + 4 ? 1 : 0} />
          {f >= lock + 6 && (
            <In at={lock + 6} style={{ marginTop: 10 }}>
              <Card style={{ padding: 12, width: 376 }}>
                <div style={{ ...TD.cardTitle }}>Maya's 23rd · {money(TOTAL)} · locked</div>
                {rows.map(([n, c, s], i) => (
                  <In key={n} at={lock + 10 + i * 5}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: i ? `1px solid ${D.border}` : 'none', marginTop: i ? 0 : 6 }}>
                    <Av name={n} size={24} /><span style={{ flex: 1, ...TD.value, fontWeight: 600, fontSize: 14 }}>{n}</span><span style={{ ...TD.money, fontSize: 14, marginRight: 8 }}>{money(c)}</span><DotChip label={s} dot={i ? D.pink : D.warning} />
                  </div></In>
                ))}
              </Card>
              <In at={lock + 40} style={{ marginTop: 10 }}>
                <div style={{ padding: '9px 12px', borderRadius: 12, background: 'rgba(52,199,123,0.14)', color: D.success, fontFamily: F.mono, fontSize: 11.5, display: 'flex', justifyContent: 'space-between', width: 376, boxSizing: 'border-box' }}>
                  <span>{rows.map((r) => money(r[1])).join(' + ')} =</span><b>{money(TOTAL)} ✓</b>
                </div>
              </In>
            </In>
          )}
        </Scaled>
      </div>
    </Page>
  );
}

// ================================================================== 15. pay in one tap
export function Pay() {
  const f = useCurrentFrame();
  const tap = 34;
  const done = f >= tap + 4;
  const wallet = BAR * 2;
  const added = wallet + 52;
  const cashSheet = wallet + 92;
  const cashed = wallet + 136;
  const balance = WALLET_BEFORE - SHARES.Alex;
  const CASHOUT = 4000;
  const cents = (v: number) => Math.round(v / 10) * 10;
  const shown = f < added ? balance : f < cashed ? cents(countUp(f, added, 30, balance, balance + TOPUP)) : cents(countUp(f, cashed, 26, balance + TOPUP, balance + TOPUP - CASHOUT));
  const latest: [string, string, number] = f < added ? [`−${money(SHARES.Alex)}`, 'Paid Maya', wallet] : f < cashed ? [`+${money(TOPUP)}`, 'Apple Pay top-up', added] : [`−${money(CASHOUT)}`, 'Cash out to your bank', cashed];
  return (
    <Page glow={0.45}>
      <Heading main="Pay in" accent="one tap." />
      {f < wallet ? (
        <>
          <div style={{ position: 'absolute', left: 70, top: 480 }}>
            <Scaled s={2.3}>
              <Card style={{ width: 300, padding: 14, minHeight: 300, background: D.sheet }}>
                {!done ? (
                  <>
                    <div style={{ ...TD.heading, textAlign: 'center' }}>Pay Maya</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}><Av name="Maya" size={34} /><div><div style={{ ...TD.caption, fontSize: 11 }}>You're paying</div><div style={{ ...TD.cardTitle }}>Maya</div><div style={{ ...TD.caption, fontSize: 11 }}>For Maya's 23rd at Golden Lantern</div></div></div>
                    <div style={{ margin: '10px 0', padding: '10px 0', borderRadius: 14, background: D.surfaceAlt, textAlign: 'center' }}><div style={{ fontFamily: F.mono, fontSize: 32, color: D.text }}>{money(SHARES.Alex)}</div><div style={{ ...TD.caption, fontSize: 10.5 }}>Your exact share. Only this amount, only to Maya.</div></div>
                    {[['Pork dumplings · split 2 ways', 1300], ['Crispy chicken', 2400], ['Your share of the surcharge', ALEX_EXTRA]].map(([n, c]) => <div key={n} style={{ display: 'flex', justifyContent: 'space-between', ...TD.caption, fontSize: 11 }}><span>{n}</span><span style={{ fontFamily: F.mono, color: D.text }}>{money(c as number)}</span></div>)}
                    <div style={{ ...TD.caption, fontSize: 11, marginTop: 8 }}>From your wya wallet · {money(WALLET_BEFORE)} · {money(balance)} left after</div>
                    <Btn title={<>{I.lock()} Pay Maya {money(SHARES.Alex)}</>} style={{ marginTop: 10 }} pressed={f >= tap && f < tap + 4 ? 1 : 0} />
                  </>
                ) : (
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 40 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 28, background: D.success, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop(f, tap + 4, 220, 12)})` }}>{I.check(D.bg, 30)}</div>
                    <div style={{ ...TD.title }}>Paid Maya</div>
                    <div style={{ fontFamily: F.mono, fontSize: 28, color: D.text }}>{money(SHARES.Alex)}</div>
                    <div style={{ ...TD.caption, textAlign: 'center' }}>Maya sees it straight away. Left in your wallet: {money(balance)}.</div>
                    <Burst at={tap + 4} x={150} y={60} />
                  </div>
                )}
              </Card>
            </Scaled>
          </div>
          {done && (
            <div style={{ position: 'absolute', left: 70, top: 1200, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Only your exact share', 'Only to the person who paid', 'Never twice'].map((t, i) => (
                <In key={t} at={tap + 16 + i * 10}><div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: F.body, fontWeight: 600, fontSize: 34, color: D.text }}><div style={{ width: 40, height: 40, borderRadius: 20, background: D.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{I.check(D.bg, 22)}</div>{t}</div></In>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <In at={wallet} style={{ position: 'absolute', left: 70, top: 470 }}>
            <div style={{ width: 940, height: 540, borderRadius: 54, padding: 50, boxSizing: 'border-box', background: '#111114', backgroundImage: 'radial-gradient(90% 120% at 100% 0%, rgba(122,80,255,0.55) 0%, transparent 60%), radial-gradient(80% 100% at 0% 100%, rgba(255,46,122,0.35) 0%, transparent 60%), linear-gradient(135deg, #17171C, #0B0B0D)', border: `2px solid ${D.border}` }}>
              <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 56, color: '#fff' }}>wya wallet</div>
              <div style={{ fontFamily: F.body, fontSize: 32, color: 'rgba(255,255,255,0.68)', marginTop: 24 }}>Balance</div>
              <div style={{ fontFamily: F.mono, fontSize: 130, color: '#fff', letterSpacing: -4, transform: `scale(${1 + 0.04 * Math.max(0, 1 - Math.abs(f - (f < cashed ? added + 15 : cashed + 12)) / 15)})`, transformOrigin: 'left center' }}>{money(shown)}</div>
              <div key={latest[1]} style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, padding: '16px 22px', borderRadius: 22, background: 'rgba(255,255,255,0.07)', fontFamily: F.body, fontSize: 32, color: '#fff', opacity: glide(f, latest[2], 8) }}>
                <span style={{ fontFamily: F.mono, fontWeight: 500, color: latest[0].startsWith('+') ? D.success : '#fff' }}>{latest[0]}</span><span style={{ color: 'rgba(255,255,255,0.68)' }}>{latest[1]}</span>
              </div>
            </div>
          </In>
          {f < cashSheet ? (
            <In at={wallet + 12} style={{ position: 'absolute', left: 192, top: 1060 }}>
              <Scaled s={2.4}>
                <Card style={{ width: 290, padding: 12, background: '#F5F5F7', border: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: F.body, fontWeight: 700, fontSize: 15, color: D.bg }}><span>Top up</span><span style={{ fontWeight: 400, fontSize: 11, color: '#55555D' }}>Apple Pay</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.body, fontSize: 12.5, color: D.bg, marginTop: 10 }}><span>Add to wya wallet</span><span style={{ fontFamily: F.mono }}>{money(TOPUP)}</span></div>
                  <Btn title={f >= added ? <>{I.check(D.bg)} Added</> : `Confirm ${money(TOPUP)}`} style={{ marginTop: 10, background: f >= added ? D.success : D.bg, color: f >= added ? D.bg : '#fff' }} pressed={f >= added - 4 && f < added ? 1 : 0} />
                </Card>
              </Scaled>
            </In>
          ) : (
            <In at={cashSheet} style={{ position: 'absolute', left: 192, top: 1060 }}>
              <Scaled s={2.4}>
                <Card style={{ width: 290, padding: 12, background: D.sheet }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...TD.cardTitle, fontSize: 15 }}><span>Cash out</span><span style={{ ...TD.caption, fontSize: 11 }}>To your bank · •••• 4417</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', ...TD.value, fontSize: 12.5, marginTop: 10 }}><span>Amount</span><span style={{ fontFamily: F.mono }}>{money(CASHOUT)}</span></div>
                  <Btn title={f >= cashed ? <>{I.check(D.bg)} On its way to your bank</> : `Cash out ${money(CASHOUT)}`} variant={f >= cashed ? 'success' : 'primary'} style={{ marginTop: 10 }} pressed={f >= cashed - 4 && f < cashed ? 1 : 0} />
                </Card>
              </Scaled>
            </In>
          )}
        </>
      )}
    </Page>
  );
}

// ================================================================== 16. everyone's square
export function Square() {
  const f = useCurrentFrame();
  const rows: [string, number, number][] = [['Alex', SHARES.Alex, 0], ['Jamie', SHARES.Jamie, 14], ['Sam', SHARES.Sam, 34]];
  const owed = rows.reduce((s, r) => s + (f >= r[2] ? 0 : r[1]), 0);
  return (
    <Page>
      <Heading main="Everyone's" accent="square." top={1000} size={110} align="center" enter="zoom" />
      <In at={20} style={{ position: 'absolute', left: 70, right: 70, top: 1140, textAlign: 'center', fontFamily: F.body, fontSize: 44, color: D.textSecondary }}>Before the Uber home.</In>
      <div style={{ ...COL, top: 360 }}>
        <Scaled s={S}>
          <Card style={{ padding: 12, width: 376 }}>
            <div style={{ ...TD.cardTitle }}>Maya's 23rd · dues</div>
            {rows.map(([n, c, at], i) => {
              const paid = f >= at;
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${D.border}` : 'none', marginTop: i ? 0 : 6 }}>
                  <Av name={n} size={24} /><span style={{ flex: 1, ...TD.value, fontSize: 14 }}>{n} → Maya</span><span style={{ ...TD.money, fontSize: 14, marginRight: 8 }}>{money(c)}</span>
                  {paid ? <div style={{ transform: `scale(${0.8 + 0.2 * pop(f, at, 260, 14)})` }}><DotChip label="Paid · wallet" dot={D.success} /></div> : <DotChip label="Owes" dot={D.pink} />}
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '8px 10px', borderRadius: 10, background: D.surfaceAlt, ...TD.value, fontSize: 13 }}><span>Still owed to Maya</span><span style={{ fontFamily: F.mono, fontWeight: 600 }}>{money(owed)}</span></div>
          </Card>
        </Scaled>
      </div>
    </Page>
  );
}

// ================================================================== 17. close
export function Close() {
  const f = useCurrentFrame();
  return (
    <Page glow={0.55}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 140 }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * pop(f, 0, 200, 12)})`, fontFamily: F.body, fontWeight: 700, fontSize: 230, letterSpacing: -12, color: D.text, lineHeight: 1 }}>wya<span style={{ color: D.pink }}>.</span></div>
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 64, color: D.textSecondary, opacity: glide(f, 10, 8) }}>where you at? <span style={{ color: D.text }}>right here.</span></div>
        <In at={BEAT * 3} style={{ marginTop: 40 }}><div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 72, letterSpacing: -3, color: D.text }}>Plans that actually happen.</div></In>
        <In at={BEAT * 5}><div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 64, color: D.accent }}>and bills that actually get paid.</div></In>
        <In at={BAR * 2} style={{ marginTop: 50 }}><div style={{ padding: '20px 44px', borderRadius: 999, background: D.text, color: D.bg, fontFamily: F.body, fontWeight: 700, fontSize: 48, transform: 'rotate(-3deg)' }}>Coming soon</div></In>
      </AbsoluteFill>
    </Page>
  );
}
