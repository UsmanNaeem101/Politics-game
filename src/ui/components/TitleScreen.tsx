import { useState } from 'react';
import { OBJECTIVES, PLAYABLE, createScenario, styleOf, type CharId, type GameState } from '../../engine';
import { Shield } from './Shield';

// A throwaway game, only to read the cast for the selection screen.
const CAST: GameState = createScenario(1, 'osric');

const DIFFICULTY_ORDER = { Gentle: 0, Cunning: 1, Treacherous: 2, Desperate: 3 } as const;

export function TitleScreen({
  onStart,
  onContinue,
  hasSave,
  onHelp,
}: {
  onStart: (player: CharId, seed: number) => void;
  onContinue: () => void;
  hasSave: boolean;
  onHelp: () => void;
}) {
  const [chosen, setChosen] = useState<CharId>('edmund');
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 99999) + 1));
  const c = CAST.chars[chosen];
  const obj = OBJECTIVES[chosen];

  return (
    <div className="title-screen">
      <header className="masthead">
        <p className="eyebrow">The Season of Knives</p>
        <h1 className="display">Crown of Whispers</h1>
        <p className="lede">
          King Osric is old, and his only son is dead. Three great lords serve him. One means to murder him. One knows, and says
          nothing to the King. One is cleverer than both. In the wings stands a minor lord whose wife will not let him stay small,
          and two brothers who have not forgiven him for what he stole. No armies march here. There are only motives, and
          the people who hide them.
        </p>
        <div className="title-actions">
          {hasSave && (
            <button className="btn btn--primary" onClick={onContinue}>
              Continue your game
            </button>
          )}
          <button className="btn" onClick={onHelp}>
            How to play
          </button>
        </div>
      </header>

      <section className="select" aria-labelledby="choose-h">
        <h2 id="choose-h" className="section-title">
          Choose whose eyes you see through
        </h2>
        <div className="select-grid">
          <ul className="cast-list" role="listbox" aria-label="Characters">
            {PLAYABLE.slice()
              .sort((a, b) => DIFFICULTY_ORDER[CAST.chars[a].playable.difficulty] - DIFFICULTY_ORDER[CAST.chars[b].playable.difficulty])
              .map((id) => {
                const ch = CAST.chars[id];
                return (
                  <li key={id}>
                    <button
                      role="option"
                      aria-selected={chosen === id}
                      className={`cast-item ${chosen === id ? 'is-chosen' : ''}`}
                      onClick={() => setChosen(id)}
                    >
                      <Shield h={ch.heraldry} size={30} crowned={ch.rank === 'king'} />
                      <span className="cast-name">
                        <span>{ch.name}</span>
                        <small>{styleOf(CAST, id)}</small>
                      </span>
                      <span className={`chip chip--${ch.playable.difficulty.toLowerCase()}`}>{ch.playable.difficulty}</span>
                    </button>
                  </li>
                );
              })}
          </ul>

          <article className="cast-detail" aria-live="polite">
            <div className="cast-detail-head">
              <Shield h={c.heraldry} size={84} crowned={c.rank === 'king'} />
              <div>
                <h3 className="display-sm">{c.name}</h3>
                <p className="muted">
                  {styleOf(CAST, chosen)} · {c.epithet} · age {c.age}
                </p>
              </div>
            </div>
            <p className="blurb">{c.playable.blurb}</p>
            <dl className="objective">
              <dt>Your aim</dt>
              <dd>
                <strong>{obj.title}.</strong> {obj.goal}
              </dd>
              <dt>Triumph</dt>
              <dd>{obj.triumph}</dd>
            </dl>
            <div className="start-row">
              <label className="field field--inline">
                <span>Seed</span>
                <input
                  id="seed"
                  inputMode="numeric"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value.replace(/\D/g, '').slice(0, 9))}
                />
              </label>
              <button className="btn btn--primary btn--lg" onClick={() => onStart(chosen, Number(seed) || 1)}>
                Enter the court as {c.short}
              </button>
            </div>
            <p className="fine">The same seed and the same choices always tell the same story.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
