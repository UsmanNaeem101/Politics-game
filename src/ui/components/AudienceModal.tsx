import { ch, nm, styleOf, type Audience, type Outcome } from '../../engine';
import { useGame } from '../context';
import { Shield } from './Shield';

const KIND_LABEL: Record<Audience['kind'], string> = {
  recruit: 'A proposal',
  blackmail: 'A threat',
  counsel: 'Your spouse',
  judgment: 'Judgment',
  accused: 'Accused',
  petition: 'A petition',
  witan: 'The Witan',
  'pledge-due': 'An oath',
};

export function AudienceModal({ audience, onDone }: { audience: Audience; onDone: (title: string, o: Outcome) => void }) {
  const { s, resolve } = useGame();
  const from = ch(s, audience.from);
  const isSelf = audience.from === s.player;

  return (
    <div className="modal-backdrop modal-backdrop--audience" role="presentation">
      <div className="modal audience" role="alertdialog" aria-modal="true" aria-labelledby="aud-h">
        <header className="audience-head">
          {!isSelf && <Shield h={from.heraldry} size={56} status={from.status} crowned={s.king === audience.from} />}
          <div>
            <p className="eyebrow">{KIND_LABEL[audience.kind]}</p>
            <h2 id="aud-h" className="display-sm">
              {audience.title}
            </h2>
            {!isSelf && (
              <p className="muted">
                {nm(s, audience.from)}, {styleOf(s, audience.from)}
              </p>
            )}
          </div>
        </header>
        <div className="audience-text">
          {audience.text.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <div className="audience-options">
          {audience.options.map((o) => (
            <button key={o.id} className={`option option--${o.tone ?? 'neutral'}`} onClick={() => onDone(audience.title, resolve(audience.id, o.id))}>
              <span className="option-label">{o.label}</span>
              {o.hint && <span className="option-hint">{o.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** What came of an answer, shown before the next visitor is let in. */
export function Aftermath({ title, outcome, onClose }: { title: string; outcome: Outcome; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal aftermath" role="dialog" aria-modal="true" aria-labelledby="after-h">
        <header className="modal-head">
          <h2 id="after-h" className="display-sm">
            {title}
          </h2>
        </header>
        <div className={`modal-body outcome outcome--${outcome.tone}`}>
          <p>{outcome.text}</p>
        </div>
        <footer className="modal-foot">
          <span />
          <button className="btn btn--primary" onClick={onClose} autoFocus>
            Continue
          </button>
        </footer>
      </div>
    </div>
  );
}
