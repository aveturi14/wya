import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Avatar, Glow, Kinetic, Pill, Poster } from '../components/Brand';
import { glide, leave, lerp, pop } from '../components/motion';
import { Callout, Chip, LinkIcon, Panel, SceneShell, Tap } from '../components/Ui';
import { BAR, BEAT, EVENT, LABELS, ORGANISER, PEOPLE, sceneLength } from '../data/demo';
import { C, F, LOOKS } from '../styles/tokens';

const LENGTH = sceneLength('invite');
export const SHARE_TAP = 30;
export const LINK_AT = 40;
export const RSVP_AT = BAR * 2; // the RSVP panel arrives on bar 3
export const YES_TAP = RSVP_AT + 24;
export const GOING_AT = (i: number) => RSVP_AT + 40 + i * BEAT; // guests flip to Going on the beat
export const NOT_PAID_AT = BAR * 4 + 10;

/** Scene 3: one link to the group; everyone answers. Answering is not paying. */
export default function S3Invite() {
  const frame = useCurrentFrame();
  const phaseA = leave(frame, RSVP_AT, 12); // share + link
  const phaseB = glide(frame, RSVP_AT - 4, 14) * leave(frame, NOT_PAID_AT, 12); // RSVP
  const phaseC = glide(frame, NOT_PAID_AT - 4, 12); // the callout
  const guests = PEOPLE.filter((p) => p !== ORGANISER);
  const allIn = frame >= GOING_AT(guests.length - 1);

  return (
    <SceneShell length={LENGTH} bg={C.bg} enter="none">
      <Glow look={LOOKS.sunset} opacity={0.4} y={-16} />

      {/* The poster stays pinned at the top as the event's identity */}
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: lerp(glide(frame, 0, 16), 520, 250) }}>
        <div style={{ transform: `scale(${lerp(glide(frame, 0, 16), 1.02, 0.5) - phaseC * 0.06})`, transformOrigin: 'top center' }}>
          <Poster
            title={EVENT.title}
            line={EVENT.line}
            foot={`${EVENT.day.toUpperCase()} · ${EVENT.city.toUpperCase()}`}
            stickers={[{ label: allIn ? '4 going' : 'planning', x: 470, y: 50, tilt: 6, bg: allIn ? C.text : C.white, fg: allIn ? C.white : C.text }]}
          />
        </div>
      </AbsoluteFill>

      {/* Phase A: share once, one link reaches everyone */}
      {phaseA > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 830, gap: 60, opacity: phaseA }}>
          <div style={{ transform: `scale(${pop(frame, 6)})` }}>
            <Pill>Share invite</Pill>
          </div>
          {frame >= LINK_AT && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '26px 40px', borderRadius: 999, background: C.surface, boxShadow: '0 20px 50px rgba(20,10,30,0.12)', fontFamily: F.mono, fontWeight: 500, fontSize: 38, color: C.text, transform: `scale(${pop(frame, LINK_AT, 200, 14)})` }}>
              <LinkIcon />
              wya.expo.app/invite/harbour
            </div>
          )}
          <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
            {PEOPLE.map((p, i) => {
              const t = pop(frame, LINK_AT + 18 + i * 6, 180, 12);
              return (
                <div key={p} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, opacity: Math.min(1, t * 1.5), transform: `translateY(${(1 - t) * -120}px) scale(${0.5 + 0.5 * t})` }}>
                  <Avatar name={p} size={150} />
                  <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 34, color: C.text }}>{p}</div>
                </div>
              );
            })}
          </div>
          <Tap x={540} y={890} at={SHARE_TAP} />
        </AbsoluteFill>
      )}

      {/* Phase B: the app's RSVP bar, then the guest list updating */}
      {phaseB > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 800, opacity: phaseB, transform: `translateY(${(1 - glide(frame, RSVP_AT - 4, 14)) * 80}px)` }}>
          <Panel style={{ width: 900, padding: 40 }}>
            <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1, marginBottom: 28 }}>Are you coming?</div>
            <div style={{ display: 'flex', gap: 18 }}>
              {LABELS.rsvp.map((l, i) => {
                const chosen = i === 0 && frame >= YES_TAP;
                return (
                  <div key={l} style={{ flex: 1, height: 110, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 38, background: chosen ? C.text : C.surfaceAlt, color: chosen ? C.white : C.text, transform: `scale(${chosen ? 1 + 0.06 * (1 - glide(frame, YES_TAP, 10)) : 1})` }}>
                    {l}
                  </div>
                );
              })}
            </div>
          </Panel>
          <Tap x={250} y={1010} at={YES_TAP} />
          <Panel style={{ width: 900, padding: '24px 40px', marginTop: 34 }}>
            {PEOPLE.map((p, i) => {
              const host = p === ORGANISER;
              const gi = guests.indexOf(p as (typeof guests)[number]);
              const going = !host && frame >= GOING_AT(gi);
              const flip = going ? pop(frame, GOING_AT(gi), 260, 14) : 0;
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '18px 0', borderTop: i ? `2px solid ${C.border}` : 'none' }}>
                  <Avatar name={p} size={86} ring={C.surface} />
                  <div style={{ flex: 1, fontSize: 42, fontWeight: 600 }}>{p}</div>
                  {host ? <Chip label="Hosting" tone="ink" /> : going ? <div style={{ transform: `scale(${0.7 + 0.3 * flip})` }}><Chip label="Going" tone="success" /></div> : <Chip label="Invited" tone="neutral" />}
                </div>
              );
            })}
          </Panel>
        </AbsoluteFill>
      )}

      {/* Phase C: the honest beat. Saying yes isn't paying. */}
      {phaseC > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 520, gap: 30 }}>
          <Kinetic text="Saying yes" at={NOT_PAID_AT} size={130} />
          <Kinetic text="isn't paying." at={NOT_PAID_AT + 8} size={130} italicWords={['paying.']} />
          <Callout at={NOT_PAID_AT + 26} style={{ marginTop: 30 }}>
            <Chip label="4 going · $0 sorted" tone="warning" style={{ fontSize: 40 }} />
          </Callout>
        </AbsoluteFill>
      )}
    </SceneShell>
  );
}
