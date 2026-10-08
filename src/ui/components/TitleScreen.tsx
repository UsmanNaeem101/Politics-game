import { useMemo, useState } from 'react';
import { KINGDOM, TRAIT_WORDS, generateCourt, incomeOf, knownSecrets, landsOf, type TraitKey } from '../../engine';
import { GIcon, type GIName } from '../icons/GIcon';
import { Shield } from './Shield';

const randomSeed = () => Math.floor(Math.random() * 999999) + 1;

export function TitleScreen({
  onStart,
  onContinue,
  hasSave,
  onHelp,
}: {
  onStart: (seed: number, name: string) => void;
  onContinue: () => void;
  hasSave: boolean;
  onHelp: () => void;
}) {
  const [seed, setSeed] = useState(randomSeed);
  const [name, setName] = useState('');
  const court = useMemo(() => generateCourt(seed, { playerName: name }), [seed, name]);
  const me = court.chars[court.player];
  const house = court.houses[me.householdId];
  const wife = me.spouse ? court.chars[me.spouse] : undefined;
  const brothers = me.siblings.map((b) => court.chars[b]);
  const king = court.king ? court.chars[court.king] : undefined;
  const rumours = knownSecrets(court, court.player).filter((k) => k.k.source !== 'self');
  const traits = (Object.keys(TRAIT_WORDS) as TraitKey[]).filter((k) => me.traits[k] >= 66 || me.traits[k] <= 30);

  return (
    <div className="title-screen">
      <header className="masthead">
        <p className="eyebrow">The court of {KINGDOM}</p>
        <h1 className="display">Crown of Whispers</h1>
        <p className="lede">
          The King is old and has no heir. When he dies, the lords of the Witan will choose who follows him, and every one of them is counting.
          You are a minor lord with small lands, an old name nobody remembers, and a seat at the bottom of the hall. Everyone here wants
          something. Most of them are lying about what. Rise to the throne, or die trying.
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

      <section className="fortune" aria-labelledby="fortune-h">
        <h2 id="fortune-h" className="section-title">
          Your fortune
        </h2>
        <article className="fortune-card">
          <div className="fortune-head">
            <Shield h={house.heraldry} size={88} />
            <div>
              <h3 className="display-sm fortune-name">{me.name}</h3>
              <p className="muted">
                Lord of {house.seat ? court.lands[house.seat].name : house.name} · {me.epithet} · age {me.age}
              </p>
              {house.motto && <p className="motto">“{house.motto}”</p>}
            </div>
          </div>

          <div className="fortune-grid">
            <div className="fortune-cell">
              <span className="fortune-label">
                <GIcon name="family" size={15} /> Your household
              </span>
              <ul>
                {wife ? <li>Your wife, {wife.name}</li> : <li>No wife</li>}
                {brothers.map((b) => (
                  <li key={b.id}>Your brother, {b.name}</li>
                ))}
                {house.members
                  .filter((m) => court.chars[m].rank === 'servant')
                  .map((m) => (
                    <li key={m} className="muted">
                      {court.chars[m].name}, your {court.chars[m].role}
                    </li>
                  ))}
              </ul>
            </div>
            <div className="fortune-cell">
              <span className="fortune-label">
                <GIcon name="land" size={15} /> Your means
              </span>
              <ul>
                {landsOf(court, me.id).map((l) => (
                  <li key={l}>{court.lands[l].name}</li>
                ))}
                <li>
                  <GIcon name="gold" size={13} /> {me.gold} crowns, +{incomeOf(court, me.id)} a week
                </li>
              </ul>
            </div>
            <div className="fortune-cell">
              <span className="fortune-label">
                <GIcon name="will" size={15} /> Your temperament
              </span>
              <div className="tags">
                {traits.length === 0 && <span className="muted small">Even-tempered.</span>}
                {traits.map((k) => (
                  <span key={k} className={`tag ${me.traits[k] >= 66 ? '' : 'tag--low'}`}>
                    <GIcon name={k as GIName} size={13} /> {TRAIT_WORDS[k][me.traits[k] >= 66 ? 1 : 0]}
                  </span>
                ))}
              </div>
            </div>
            <div className="fortune-cell">
              <span className="fortune-label">
                <GIcon name="secret" size={15} /> You arrive having heard
              </span>
              {rumours.length === 0 ? (
                <p className="muted small">Nothing yet.</p>
              ) : (
                <ul>
                  {rumours.slice(0, 2).map((r) => (
                    <li key={r.sec.id} className="rumour">
                      “{r.text}” <span className="muted small">({r.k.credence >= 60 ? 'you believe it' : 'you half believe it'})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {king && (
            <p className="muted small">
              The court of King {king.short}, {king.epithet}, age {king.age}. {Object.values(court.houses).filter((h) => h.rank === 'great').length} great houses and{' '}
              {Object.values(court.houses).filter((h) => h.rank === 'lesser').length - 1} lesser ones besides yours. You know almost none of them.
            </p>
          )}

          <div className="start-row">
            <label className="field field--inline">
              <span>Your name</span>
              <input id="player-name" value={name} placeholder={me.short} maxLength={20} onChange={(e) => setName(e.target.value.replace(/[^\p{L}' -]/gu, ''))} />
            </label>
            <label className="field field--inline">
              <span>Seed</span>
              <input id="seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(Number(e.target.value.replace(/\D/g, '').slice(0, 9)) || 1)} />
            </label>
            <button className="btn" onClick={() => setSeed(randomSeed())}>
              Another fortune
            </button>
            <button className="btn btn--primary btn--lg" onClick={() => onStart(seed, name)}>
              Enter the court
            </button>
          </div>
          <p className="fine">The same seed and the same choices always tell the same story.</p>
        </article>
      </section>
    </div>
  );
}
