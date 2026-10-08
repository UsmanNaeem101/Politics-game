import { useMemo, useState, type ReactNode } from 'react';
import {
  ACTION_INFO,
  COST,
  OFFICE_NAMES,
  blackmailFear,
  ch,
  chanceWord,
  chargesFor,
  check,
  clampPct,
  complianceOdds,
  credence,
  denounceOdds,
  directiveText,
  fabricateEvidence,
  first,
  hearCredence,
  influence,
  introductionOdds,
  acquaintance,
  knownSecrets,
  landsOf,
  nm,
  officeEligible,
  offerLabel,
  petitionOdds,
  plotViews,
  recruitOdds,
  spyChance,
  strikeChance,
  type CharId,
  type DirectiveSpec,
  type FabricateKind,
  type GameState,
  type Intent,
  type IntentType,
  type Offer,
  type OfficeId,
  type Outcome,
  type SpyFocus,
} from '../../engine';
import { useGame, type DeedSpec } from '../context';
import { Icon } from './Icon';
import { Shield } from './Shield';

interface Estimate {
  pct?: number;
  lines: string[];
}

const OFFICES: OfficeId[] = ['marshal', 'chancellor', 'spymaster', 'captain', 'confessor'];

/** People the player could name in a deed: never strangers. */
function others(s: GameState, filter: (id: CharId) => boolean = () => true, minLevel = 1): CharId[] {
  const P = s.player;
  return s.order.filter((id) => id !== P && acquaintance(s, id) >= minLevel && filter(id));
}

const free = (s: GameState) => (id: CharId) => ch(s, id).status === 'free';
const met = (s: GameState) => (id: CharId) => ch(s, id).status === 'free' && acquaintance(s, id) >= (ch(s, id).rank === 'servant' ? 2 : 3);

export function DeedDialog({ spec, onClose }: { spec: DeedSpec; onClose: () => void }) {
  const { s, act } = useGame();
  const P = s.player;
  const me = ch(s, P);
  const type: IntentType = spec.type;
  const info = ACTION_INFO[type];

  const [result, setResult] = useState<Outcome | null>(null);
  const [target, setTarget] = useState<CharId>(spec.target ?? '');
  const [secretId, setSecretId] = useState<string>(spec.secretId ?? '');
  const [plotId, setPlotId] = useState<string>(spec.plotId ?? '');
  const [amount, setAmount] = useState<number>(Math.min(25, me.gold));
  const [focus, setFocus] = useState<SpyFocus>('motive');
  const [fabKind, setFabKind] = useState<FabricateKind>('regicide');
  const [guilty, setGuilty] = useState<CharId[]>(spec.target ? [spec.target] : []);
  const [victim, setVictim] = useState<CharId>(s.king ?? '');
  const [schemeKind, setSchemeKind] = useState<'murder' | 'ruin'>('ruin');
  const [targets, setTargets] = useState<CharId[]>(spec.target ? [spec.target] : []);
  const [charges, setCharges] = useState<string[]>(spec.secretId ? [spec.secretId] : []);
  const [offerKind, setOfferKind] = useState<Offer['kind']>('none');
  const [landId, setLandId] = useState<string>('');
  const [office, setOffice] = useState<OfficeId>('marshal');
  const [demand, setDemand] = useState<'gold' | 'restitution' | 'join'>('gold');
  const [petKind, setPetKind] = useState<'restitution' | 'office' | 'mercy'>(spec.target && ch(s, spec.target).status === 'imprisoned' ? 'mercy' : 'restitution');
  const [mode, setMode] = useState<'goad' | 'restrain' | 'demand'>('goad');
  const [dirKind, setDirKind] = useState<DirectiveSpec['kind']>('denounce');
  const [source, setSource] = useState<'plot' | 'secret'>(spec.plotId ? 'plot' : 'secret');
  const [accused, setAccused] = useState<CharId[] | null>(null);

  const secrets = useMemo(() => knownSecrets(s, P), [s, P]);
  const usable = secrets.filter((k) => k.k.lie || k.k.credence >= 40);
  const myPlots = Object.values(s.plots).filter((p) => p.status === 'active' && p.owner === P);
  const myRuin = myPlots.filter((p) => p.kind === 'ruin');
  const workable = Object.values(s.plots).filter((p) => p.status === 'active' && (p.owner === P || p.members.some((m) => m.id === P)));
  const myLands = landsOf(s, P).map((l) => s.lands[l]);
  const crownLands = s.king === P ? Object.values(s.lands).filter((l) => l.holder === null) : [];

  const offer: Offer = (() => {
    switch (offerKind) {
      case 'gold':
        return { kind: 'gold', amount };
      case 'land':
      case 'restitution':
        return { kind: offerKind, landId };
      case 'office':
        return { kind: 'office', office };
      default:
        return { kind: offerKind };
    }
  })();

  const directive: DirectiveSpec | undefined = (() => {
    if (mode !== 'demand') return undefined;
    if (dirKind === 'restore') return { kind: 'restore' };
    return plotId ? { kind: dirKind, plotId } : undefined;
  })();

  const intent: Intent | null = (() => {
    switch (type) {
      case 'spy':
        return target ? { type, target, focus } : null;
      case 'introduce':
        return target ? { type, target } : null;
      case 'converse':
        return target ? { type, target } : null;
      case 'arrest':
        return target ? { type, target } : null;
      case 'question':
        return target ? { type, target } : null;
      case 'execute':
        return target ? { type, target } : null;
      case 'release':
        return target ? { type, target } : null;
      case 'gift':
        return target ? { type, target, amount } : null;
      case 'whisper':
        return target && secretId ? { type, target, secretId } : null;
      case 'fabricate':
        return { type, kind: fabKind, guilty, victim: fabKind === 'murder' ? victim : s.king ?? '' };
      case 'scheme':
        return { type, kind: schemeKind, targets: schemeKind === 'murder' ? targets.slice(0, 1) : targets, charges: schemeKind === 'ruin' ? charges : [] };
      case 'advance':
        return plotId ? { type, plotId, gold: s.plots[plotId]?.kind === 'murder' ? amount : 0 } : null;
      case 'recruit':
        return target && plotId ? { type, target, plotId, offer } : null;
      case 'denounce': {
        if (source === 'plot') return plotId ? { type, plotId, only: accused ?? undefined } : null;
        return secretId ? { type, secretId, only: accused ?? undefined } : null;
      }
      case 'strike':
        return plotId ? { type, plotId } : null;
      case 'abandon':
        return plotId ? { type, plotId } : null;
      case 'blackmail':
        return target && secretId ? { type, target, secretId, demand, plotId: demand === 'join' ? plotId : undefined } : null;
      case 'petition':
        return { type, kind: petKind, office: petKind === 'office' ? office : undefined, target: petKind === 'mercy' ? target : undefined };
      case 'counsel':
        return me.spouse ? { type, target: me.spouse, mode, directive } : null;
      case 'guard':
        return { type };
      case 'flee':
        return { type };
      case 'escape':
        return { type };
      case 'grant':
        return target && landId ? { type, target, landId } : null;
      case 'appoint':
        return target ? { type, target, office } : null;
    }
  })();

  const problem = intent ? check(s, P, intent) : 'Make your choices above.';
  const est = intent && !problem ? estimate(s, P, intent) : null;
  const subject = spec.target ?? (type === 'counsel' ? me.spouse : undefined);

  const doIt = () => {
    if (!intent || problem) return;
    setResult(act(intent));
  };

  const pick = (label: string, value: string, set: (v: string) => void, options: { value: string; label: string }[], id: string) => (
    <label className="field">
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => set(e.target.value)}>
        <option value="">— choose —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const personPick = (label: string, filter: (id: CharId) => boolean, id = 'deed-target') =>
    pick(label, target, setTarget, others(s, filter).map((o) => ({ value: o, label: nm(s, o) })), id);

  const checks = (label: string, values: CharId[], set: (v: CharId[]) => void, options: CharId[]) => (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="checks">
        {options.map((o) => (
          <label key={o} className="check">
            <input type="checkbox" checked={values.includes(o)} onChange={(e) => set(e.target.checked ? [...values, o] : values.filter((v) => v !== o))} />
            {nm(s, o)}
          </label>
        ))}
      </div>
    </fieldset>
  );

  let fields: ReactNode = null;
  switch (type) {
    case 'converse':
    case 'question':
    case 'arrest':
      fields = !spec.target && personPick('With whom', type === 'converse' ? met(s) : free(s));
      break;
    case 'execute':
    case 'release':
      fields = !spec.target && personPick('Prisoner', (id) => ch(s, id).status === 'imprisoned');
      break;
    case 'gift':
      fields = (
        <>
          {!spec.target && personPick('To whom', met(s))}
          <label className="field">
            <span>Crowns ({me.gold} in your purse)</span>
            <input id="deed-amount" type="range" min={5} max={Math.max(5, me.gold)} step={5} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <span className="num">{amount}</span>
          </label>
        </>
      );
      break;
    case 'whisper': {
      const listOk = secrets.filter((k) => !k.sec.guilty.includes(P));
      fields = (
        <>
          {!spec.target && personPick('To whom', met(s))}
          <fieldset className="field">
            <legend>What will you tell them?</legend>
            {listOk.length === 0 && <p className="muted">You know nothing worth whispering.</p>}
            <div className="secret-choices">
              {listOk.map((k) => (
                <label key={k.sec.id} className={`secret-choice ${secretId === k.sec.id ? 'is-on' : ''}`}>
                  <input type="radio" name="secret" checked={secretId === k.sec.id} onChange={() => setSecretId(k.sec.id)} />
                  <span>
                    {k.k.lie ? <span className="chip chip--info">Your forgery</span> : <span className="chip">{k.k.credence}% sure</span>} {k.text}
                    {target && k.sec.guilty.includes(target) ? (
                      <em className="muted"> It is their own secret.</em>
                    ) : (
                      target && credence(s, target, k.sec.id) > 0 && <em className="muted"> They seem to know already.</em>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      );
      break;
    }
    case 'fabricate': {
      const living = others(s, (id) => ['free', 'imprisoned'].includes(ch(s, id).status));
      fields = (
        <>
          <fieldset className="field">
            <legend>The lie</legend>
            <div className="radios">
              {(
                [
                  ['regicide', 'plots to murder the King'],
                  ['pact', 'have sworn a pact against the King'],
                  ['murder', 'plots to murder someone'],
                ] as [FabricateKind, string][]
              ).map(([k, l]) => (
                <label key={k} className="check">
                  <input type="radio" name="fab" checked={fabKind === k} onChange={() => setFabKind(k)} disabled={k !== 'murder' && !s.king} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          {checks('Who will you name as guilty?', guilty, setGuilty, living.filter((id) => id !== s.king || fabKind === 'murder'))}
          {fabKind === 'murder' &&
            pick(
              'Their intended victim',
              victim,
              setVictim,
              s.order.filter((id) => !guilty.includes(id) && ['free', 'imprisoned'].includes(ch(s, id).status)).map((o) => ({ value: o, label: nm(s, o) })),
              'deed-victim',
            )}
        </>
      );
      break;
    }
    case 'spy':
      fields = (
        <>
          {!spec.target && personPick('On whom', free(s))}
          <fieldset className="field">
            <legend>What should your spies look for?</legend>
            <div className="radios">
              {(
                [
                  ['motive', 'Their true design'],
                  ['household', 'Their household: who lives there, and what the servants say'],
                  ['schemes', 'The schemes they are part of (and whether they mean it)'],
                  ['secrets', 'A secret they carry'],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="check">
                  <input type="radio" name="focus" checked={focus === k} onChange={() => setFocus(k)} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      );
      break;
    case 'scheme': {
      const cands = others(s, free(s), schemeKind === 'murder' ? 2 : 1);
      const relevant = usable.filter((k) => k.sec.guilty.some((g) => targets.includes(g)) && !k.sec.guilty.includes(P));
      fields = (
        <>
          <fieldset className="field">
            <legend>Kind of scheme</legend>
            <div className="radios">
              <label className="check">
                <input type="radio" name="sk" checked={schemeKind === 'ruin'} onChange={() => setSchemeKind('ruin')} />
                Ruin — gather charges and witnesses, then denounce before the King
              </label>
              <label className="check">
                <input type="radio" name="sk" checked={schemeKind === 'murder'} onChange={() => setSchemeKind('murder')} />
                Murder — prepare a knife, a cup, or a fall
              </label>
            </div>
          </fieldset>
          {schemeKind === 'murder'
            ? pick('Victim', targets[0] ?? '', (v) => setTargets(v ? [v] : []), cands.map((o) => ({ value: o, label: nm(s, o) })), 'deed-victim')
            : checks('Whom will you bring down?', targets, setTargets, cands.filter((c) => c !== s.king))}
          {schemeKind === 'ruin' && (
            <fieldset className="field">
              <legend>Charges (what you know or have forged)</legend>
              {relevant.length === 0 && <p className="muted">You hold nothing against them. Learn a secret, or forge one first.</p>}
              <div className="secret-choices">
                {relevant.map((k) => (
                  <label key={k.sec.id} className={`secret-choice ${charges.includes(k.sec.id) ? 'is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={charges.includes(k.sec.id)}
                      onChange={(e) => setCharges(e.target.checked ? [...charges, k.sec.id] : charges.filter((c) => c !== k.sec.id))}
                    />
                    <span>
                      {k.k.lie && <span className="chip chip--info">Forgery</span>} {k.text}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      );
      break;
    }
    case 'advance': {
      const p = s.plots[plotId];
      fields = (
        <>
          {pick('Which scheme', plotId, setPlotId, workable.map((x) => ({ value: x.id, label: `“${x.name}” (${x.progress}%)` })), 'deed-plot')}
          {p?.kind === 'murder' && p.owner === P && (
            <label className="field">
              <span>Crowns for hired blades (20 each, up to 4; you have {me.gold})</span>
              <input id="deed-blades" type="range" min={0} max={Math.min(80, me.gold - (me.gold % 20))} step={20} value={Math.min(amount - (amount % 20), me.gold)} onChange={(e) => setAmount(Number(e.target.value))} />
              <span className="num">{Math.min(amount - (amount % 20), me.gold)}</span>
            </label>
          )}
        </>
      );
      break;
    }
    case 'recruit': {
      const plots = myPlots.filter((p) => !target || (!p.targets.includes(target) && !p.members.some((m) => m.id === target)));
      const rightful = myLands.filter((l) => l.rightful === target);
      fields = (
        <>
          {!spec.target && personPick('Whom', met(s))}
          {pick('Into which scheme', plotId, setPlotId, plots.map((x) => ({ value: x.id, label: `“${x.name}” — ${x.kind} of ${x.targets.map((t) => first(s, t)).join(', ')}` })), 'deed-plot')}
          <fieldset className="field">
            <legend>The carrot</legend>
            <div className="radios">
              <label className="check">
                <input type="radio" name="offer" checked={offerKind === 'none'} onChange={() => setOfferKind('none')} /> Nothing but the cause
              </label>
              <label className="check">
                <input type="radio" name="offer" checked={offerKind === 'vengeance'} onChange={() => setOfferKind('vengeance')} /> A shared enemy
              </label>
              <label className="check">
                <input type="radio" name="offer" checked={offerKind === 'gold'} onChange={() => setOfferKind('gold')} disabled={me.gold < 5} /> Gold, paid now
              </label>
              <label className="check">
                <input type="radio" name="offer" checked={offerKind === 'land'} onChange={() => setOfferKind('land')} disabled={!myLands.length} /> One of your manors
              </label>
              {rightful.length > 0 && (
                <label className="check">
                  <input type="radio" name="offer" checked={offerKind === 'restitution'} onChange={() => setOfferKind('restitution')} /> Return what is rightfully theirs
                </label>
              )}
              <label className="check">
                <input type="radio" name="offer" checked={offerKind === 'office'} onChange={() => setOfferKind('office')} /> A great office, when you rise
              </label>
            </div>
          </fieldset>
          {offerKind === 'gold' && (
            <label className="field">
              <span>Crowns</span>
              <input id="deed-amount" type="range" min={5} max={Math.max(5, me.gold)} step={5} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              <span className="num">{amount}</span>
            </label>
          )}
          {(offerKind === 'land' || offerKind === 'restitution') &&
            pick('Which land', landId, setLandId, (offerKind === 'land' ? myLands : rightful).map((l) => ({ value: l.id, label: l.name })), 'deed-land')}
          {offerKind === 'office' &&
            pick('Which office', office, (v) => setOffice(v as OfficeId), OFFICES.filter((o) => o !== 'confessor').map((o) => ({ value: o, label: OFFICE_NAMES[o] })), 'deed-office')}
        </>
      );
      break;
    }
    case 'denounce': {
      const sourceSecrets = usable.filter((k) => !k.sec.guilty.includes(P) || k.sec.guilty.length > 1);
      const charges2 = source === 'plot' ? s.plots[plotId]?.charges ?? [] : secretId ? [secretId] : [];
      const accusable = chargesFor(s, P, charges2).map((c) => c.accused);
      const chosen = accused ?? accusable;
      fields = (
        <>
          <fieldset className="field">
            <legend>Bring before the King</legend>
            <div className="radios">
              <label className="check">
                <input type="radio" name="src" checked={source === 'secret'} onChange={() => (setSource('secret'), setAccused(null))} /> A single charge you can swear to
              </label>
              <label className="check">
                <input type="radio" name="src" checked={source === 'plot'} onChange={() => (setSource('plot'), setAccused(null))} disabled={!myRuin.length} /> A ruin scheme you have prepared (charges, witnesses and all)
              </label>
            </div>
          </fieldset>
          {source === 'plot'
            ? pick('Which scheme', plotId, (v) => (setPlotId(v), setAccused(null)), myRuin.map((x) => ({ value: x.id, label: `“${x.name}” (${x.progress}%)` })), 'deed-plot')
            : (
              <fieldset className="field">
                <legend>The charge</legend>
                <div className="secret-choices">
                  {sourceSecrets
                    .filter((k) => !spec.target || k.sec.guilty.includes(spec.target))
                    .map((k) => (
                      <label key={k.sec.id} className={`secret-choice ${secretId === k.sec.id ? 'is-on' : ''}`}>
                        <input type="radio" name="charge" checked={secretId === k.sec.id} onChange={() => (setSecretId(k.sec.id), setAccused(spec.target ? [spec.target] : null))} />
                        <span>
                          {k.k.lie ? <span className="chip chip--info">Your forgery</span> : <span className="chip">{k.k.credence}% sure</span>} {k.text}
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>
            )}
          {accusable.length > 0 && checks('Accuse', chosen, (v) => setAccused(v), accusable)}
        </>
      );
      break;
    }
    case 'strike':
    case 'abandon':
      fields = pick(
        'Which scheme',
        plotId,
        setPlotId,
        (type === 'strike' ? myPlots.filter((p) => p.kind === 'murder') : workable).map((x) => ({ value: x.id, label: `“${x.name}” (${x.progress}%)` })),
        'deed-plot',
      );
      break;
    case 'blackmail': {
      const against = usable.filter((k) => k.sec.guilty.includes(target));
      const owed = Object.values(s.lands).some((l) => l.holder === target && l.rightful === P);
      fields = (
        <>
          {!spec.target && personPick('Whom', met(s))}
          <fieldset className="field">
            <legend>What you hold over them</legend>
            <div className="secret-choices">
              {against.map((k) => (
                <label key={k.sec.id} className={`secret-choice ${secretId === k.sec.id ? 'is-on' : ''}`}>
                  <input type="radio" name="bm" checked={secretId === k.sec.id} onChange={() => setSecretId(k.sec.id)} />
                  <span>{k.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="field">
            <legend>Your price</legend>
            <div className="radios">
              <label className="check">
                <input type="radio" name="dm" checked={demand === 'gold'} onChange={() => setDemand('gold')} /> Gold
              </label>
              {owed && (
                <label className="check">
                  <input type="radio" name="dm" checked={demand === 'restitution'} onChange={() => setDemand('restitution')} /> Return my stolen land
                </label>
              )}
              <label className="check">
                <input type="radio" name="dm" checked={demand === 'join'} onChange={() => setDemand('join')} disabled={!myPlots.length} /> Swear to one of my schemes
              </label>
            </div>
          </fieldset>
          {demand === 'join' && pick('Which scheme', plotId, setPlotId, myPlots.map((x) => ({ value: x.id, label: `“${x.name}”` })), 'deed-plot')}
        </>
      );
      break;
    }
    case 'petition': {
      const stolen = Object.values(s.lands).filter((l) => l.rightful === P && l.holder !== P);
      const vacant = OFFICES.filter((o) => !s.offices[o] && officeEligible(s, P, o));
      const prisoners = s.order.filter((id) => ch(s, id).status === 'imprisoned' && id !== P);
      fields = (
        <>
          <fieldset className="field">
            <legend>Ask the King for</legend>
            <div className="radios">
              <label className="check">
                <input type="radio" name="pk" checked={petKind === 'restitution'} onChange={() => setPetKind('restitution')} disabled={!stolen.length} /> Justice: the return of my stolen land
                {stolen.length > 0 && <span className="muted"> ({stolen.map((l) => l.name).join(', ')})</span>}
              </label>
              <label className="check">
                <input type="radio" name="pk" checked={petKind === 'office'} onChange={() => setPetKind('office')} disabled={!vacant.length} /> A vacant office
              </label>
              <label className="check">
                <input type="radio" name="pk" checked={petKind === 'mercy'} onChange={() => setPetKind('mercy')} disabled={!prisoners.length} /> Mercy for a prisoner
              </label>
            </div>
          </fieldset>
          {petKind === 'office' && pick('Office', office, (v) => setOffice(v as OfficeId), vacant.map((o) => ({ value: o, label: OFFICE_NAMES[o] })), 'deed-office')}
          {petKind === 'mercy' && !spec.target && pick('For whom', target, setTarget, prisoners.map((o) => ({ value: o, label: nm(s, o) })), 'deed-target')}
        </>
      );
      break;
    }
    case 'counsel': {
      const sp = me.spouse!;
      const theirs = plotViews(s, P).filter((v) => v.plot.status === 'active' && v.plot.owner === sp);
      const opts = theirs.filter((v) => (dirKind === 'strike' ? v.plot.kind === 'murder' : dirKind === 'denounce' ? v.plot.kind === 'ruin' : true));
      fields = (
        <>
          <fieldset className="field">
            <legend>What will you say to {first(s, sp)}?</legend>
            <div className="radios">
              <label className="check">
                <input type="radio" name="cm" checked={mode === 'goad'} onChange={() => setMode('goad')} /> Goad — call it cowardice to wait
              </label>
              <label className="check">
                <input type="radio" name="cm" checked={mode === 'restrain'} onChange={() => setMode('restrain')} /> Restrain — speak of the axe, and of home
              </label>
              <label className="check">
                <input type="radio" name="cm" checked={mode === 'demand'} onChange={() => setMode('demand')} /> Demand a deed
              </label>
            </div>
          </fieldset>
          {mode === 'demand' && (
            <>
              <label className="field">
                <span>The deed</span>
                <select id="deed-dir" value={dirKind} onChange={(e) => (setDirKind(e.target.value as DirectiveSpec['kind']), setPlotId(''))}>
                  <option value="denounce">Lay a ruin scheme before the King</option>
                  <option value="strike">Spring a murder scheme</option>
                  <option value="advance">Press on with a scheme</option>
                  <option value="abandon">Abandon a scheme</option>
                  <option value="restore">Return stolen land to his brothers</option>
                </select>
              </label>
              {dirKind !== 'restore' &&
                (opts.length ? (
                  pick('Which scheme of theirs', plotId, setPlotId, opts.map((v) => ({ value: v.plot.id, label: `“${v.plot.name}”` })), 'deed-plot')
                ) : (
                  <p className="muted">You know of no such scheme of {first(s, sp)}'s.</p>
                ))}
              {directive && <p className="muted">“You will {directiveText(s, directive)}.”</p>}
            </>
          )}
        </>
      );
      break;
    }
    case 'grant':
      fields = (
        <>
          {!spec.target && personPick('To whom', met(s))}
          {pick('Which land', landId, setLandId, [...myLands, ...crownLands].map((l) => ({ value: l.id, label: `${l.name}${l.rightful === target ? ' — rightfully theirs' : ''}` })), 'deed-land')}
        </>
      );
      break;
    case 'appoint':
      fields = pick(
        'Office',
        office,
        (v) => setOffice(v as OfficeId),
        OFFICES.filter((o) => !s.offices[o] && target && officeEligible(s, target, o)).map((o) => ({ value: o, label: OFFICE_NAMES[o] })),
        'deed-office',
      );
      break;
    default:
      fields = null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal deed-modal" role="dialog" aria-modal="true" aria-labelledby="deed-h">
        <header className="modal-head">
          {subject && <Shield h={ch(s, subject).heraldry} size={40} status={ch(s, subject).status} />}
          <div>
            <h2 id="deed-h" className="display-sm">
              {info.name}
              {subject && type !== 'counsel' ? ` · ${first(s, subject)}` : ''}
            </h2>
            <p className="muted">
              {info.desc} <span className="cost">{COST[type] ? `${'●'.repeat(COST[type])} time` : 'free'}</span>
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        {!result ? (
          <>
            <div className="modal-body">{fields}</div>
            <footer className="modal-foot">
              <div className="odds">
                {est?.pct !== undefined && (
                  <p className="odds-head">
                    <strong>{chanceWord(est.pct)}</strong> <span className="num">({est.pct}%)</span>
                  </p>
                )}
                {est?.lines.map((l, i) => (
                  <p key={i} className="muted small">
                    {l}
                  </p>
                ))}
                {problem && <p className="bad small">{problem}</p>}
              </div>
              <div className="foot-actions">
                <button className="btn" onClick={onClose}>
                  Not now
                </button>
                <button className={`btn btn--primary ${type === 'strike' || type === 'flee' ? 'btn--danger' : ''}`} disabled={!!problem} onClick={doIt}>
                  {info.name}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <>
            <div className={`modal-body outcome outcome--${result.tone}`}>
              <p>{result.text}</p>
            </div>
            <footer className="modal-foot">
              <span />
              <button className="btn btn--primary" onClick={onClose} autoFocus>
                Continue
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export function estimate(s: GameState, P: CharId, it: Intent): Estimate {
  const me = ch(s, P);
  switch (it.type) {
    case 'converse':
      return { lines: [`They will warm to you by about ${Math.round(6 + me.traits.charm * 0.1)}. You may read something in their face.`] };
    case 'gift': {
      const t = ch(s, it.target);
      return { lines: [`Goodwill of about +${Math.min(30, Math.round(it.amount * (0.25 + t.traits.greed / 200)))}.`] };
    }
    case 'whisper': {
      const sec = s.secrets[it.secretId];
      if (sec.guilty.includes(it.target)) {
        return { lines: [sec.truth ? 'It is their own secret. They will learn that you know — and may fear you for it.' : 'It is a lie about them. They will know it, and know you are telling it.'] };
      }
      const c = hearCredence(s, it.target, P, sec);
      return { pct: c, lines: ['How far they will believe you.'] };
    }
    case 'fabricate':
      return { lines: [`Your forgery will carry proof of about ${fabricateEvidence(s, P)}–${fabricateEvidence(s, P) + 15}. Working on a ruin scheme that uses it makes it better.`] };
    case 'spy':
      return { pct: spyChance(s, P, it.target), lines: ['If your man is caught, they may learn you were prying.'] };
    case 'introduce': {
      const { pct, via } = introductionOdds(s, P, it.target);
      return { pct, lines: [via ? `${nm(s, via)} could present you.` : 'No one you know can present you. You would have to present yourself, which is bolder and less likely to work.'] };
    }
    case 'scheme':
      return { lines: [it.kind === 'murder' ? 'A murder scheme starts unprepared. Work on it before you strike.' : 'A ruin scheme bundles your charges. Work on it and draw in witnesses before denouncing.'] };
    case 'advance':
      return { lines: [`About +${Math.round(11 + me.traits.cunning * 0.12 + (s.plots[it.plotId]?.members.length ?? 0) * 2)} preparation. The more prepared, the more it can leak.`] };
    case 'recruit': {
      const p = s.plots[it.plotId];
      return {
        pct: recruitOdds(s, P, it.target, p, it.offer),
        lines: [`Offering ${offerLabel(s, it.offer)}.`, 'Whatever they say, you will not know if they mean it. If they refuse, they still know your scheme.'],
      };
    }
    case 'denounce': {
      const reads = denounceOdds(s, P, it);
      const best = reads.length ? Math.round(reads.reduce((m, r) => m + r.pct, 0) / reads.length) : 0;
      return {
        pct: best,
        lines: [
          'Chance the King takes each accused into the Tower or worse:',
          ...reads.map((r) => `${first(s, r.accused)}: ${r.pct}%. ${r.notes.slice(-3).join(' · ')}`),
          'A failed charge costs you favour and earns the accused’s hatred.',
        ],
      };
    }
    case 'strike': {
      const p = s.plots[it.plotId];
      return { pct: strikeChance(s, p), lines: [`Even if you succeed, you may be traced (your cunning helps, more conspirators hurt).`] };
    }
    case 'blackmail': {
      const fear = blackmailFear(s, P, it.target, it.secretId);
      return { pct: clampPct(((fear - 10) / 20) * 100), lines: ['If they refuse, they will hate you — and you will have to make good on the threat or look weak.'] };
    }
    case 'petition':
      return { pct: petitionOdds(s, P, it), lines: [] };
    case 'counsel': {
      const sp = ch(s, P).spouse!;
      if (it.mode === 'demand') return { pct: complianceOdds(s, P, sp), lines: [`Chance ${first(s, sp)} finds the nerve to obey.`] };
      return { lines: [`You can move ${first(s, sp)} by about ${influence(s, P, sp)}.`] };
    }
    case 'guard':
      return { lines: ['+15 protection against knives, fading over a few weeks.'] };
    case 'flee':
      return { lines: ['You will live. Your lands are forfeit, and your part in this story ends tonight.'] };
    case 'escape':
      return { pct: clampPct(15 + me.traits.cunning * 0.2 + me.gold / 5), lines: ['It will cost every crown you have.'] };
    case 'arrest': {
      const belief = Math.max(0, ...Object.entries(s.knowledge[P] ?? {}).filter(([sid]) => s.secrets[sid]?.guilty.includes(it.target)).map(([, k]) => k.credence));
      return { lines: [belief >= 40 ? `You are ${belief}% sure of their guilt.` : 'You have no real proof. The court will call it tyranny.'] };
    }
    case 'execute': {
      const charges = s.imprisoned[it.target]?.charges ?? [];
      const belief = Math.max(0, ...charges.map((c) => credence(s, P, c)));
      return { lines: [belief >= 50 ? `You are ${belief}% sure of their guilt.` : `You are only ${belief}% sure. Killing on so little will cost you.`] };
    }
    default:
      return { lines: [] };
  }
}
