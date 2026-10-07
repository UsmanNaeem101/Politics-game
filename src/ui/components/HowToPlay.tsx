import { Icon } from './Icon';

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal help" role="dialog" aria-modal="true" aria-labelledby="help-h">
        <header className="modal-head">
          <h2 id="help-h" className="display-sm">
            How the court works
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body help-body">
          <section>
            <h3>The week</h3>
            <p>
              The season lasts twenty weeks. Each week you have three measures of <strong>time</strong> (the pips at the top). Spend them on deeds: keeping
              company, whispering, spying, scheming. When you end the week, everyone else at court takes their turn in the night. At dawn you learn what
              reached your ears, and anyone who wants something from you comes to call.
            </p>
          </section>
          <section>
            <h3>Motives are hidden</h3>
            <p>
              You can read a person’s temperament at a glance, and how they feel about you. You cannot see what they actually want. Everyone shows a face to
              the court; set spies on them to learn their <strong>true design</strong>, the schemes they are part of, and whether they mean the oaths they
              swore.
            </p>
          </section>
          <section>
            <h3>Secrets, belief and proof</h3>
            <p>
              Every secret has two numbers. <strong>Belief</strong> is how far someone credits it, and it depends on who told them and how they feel about
              the accused. <strong>Proof</strong> is how well it would stand up before the King. You can whisper what you know, or forge a lie and spread
              that instead. A clever forger’s seals are hard to see through. A careless one ends in disgrace.
            </p>
          </section>
          <section>
            <h3>Schemes</h3>
            <p>
              A <strong>murder</strong> scheme needs preparation, sworn blades and hired swords before it can strike, and even a clean kill may be traced. A{' '}
              <strong>ruin</strong> scheme gathers charges and witnesses to lay before the King. When you draw someone in, offer them a carrot: gold,
              land, an office for when you rise, a shared enemy. They may join sincerely. They may join meaning to betray you. You will not be told which.
              The more people know a scheme, the more it leaks.
            </p>
          </section>
          <section>
            <h3>The King’s justice</h3>
            <p>
              A denunciation is judged on proof, on witnesses who will speak up, and on whom the King trusts. The accused may be dismissed, taken to the
              Tower for questioning, or sent straight to the block. In the Tower, prisoners confess or name other names. On the scaffold, the condemned
              sometimes shout one last secret.
            </p>
          </section>
          <section>
            <h3>Husbands and wives</h3>
            <p>
              A strong-willed spouse can <strong>goad</strong> a timid partner into boldness, <strong>restrain</strong> a reckless one, or{' '}
              <strong>demand</strong> a particular deed. When your spouse demands something of you, heeding her costs no time: her will carries you.
            </p>
          </section>
          <section>
            <h3>If the King dies</h3>
            <p>
              Osric has no heir. If he dies, the lords of the Witan meet at the end of the following week to acclaim a new king. Win their good opinion
              before then. A man everyone knows to be the regicide cannot be acclaimed.
            </p>
          </section>
          <section>
            <h3>Winning</h3>
            <p>
              Each character has an aim and a harder triumph, shown in the Hall. At Midsummer the season ends, and the truth is revealed: every motive,
              every false oath, everything that happened in the dark.
            </p>
          </section>
        </div>
        <footer className="modal-foot">
          <span />
          <button className="btn btn--primary" onClick={onClose} autoFocus>
            To court
          </button>
        </footer>
      </div>
    </div>
  );
}
