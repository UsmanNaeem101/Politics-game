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
            <h3>Your aim</h3>
            <p>
              You are a minor lord new to the court of Wendmere. The King is old and has no heir; when he dies, the lords of the Witan choose who
              follows him. Rise to the throne, or die trying. There is no time limit. The game ends when you are crowned, killed, or run.
            </p>
          </section>
          <section>
            <h3>The week</h3>
            <p>
              Each week you have three measures of <strong>time</strong> (the hourglasses). Spend them on deeds. When you end the week, everyone else
              acts in the night. At dawn you learn what reached your ears, and anyone who wants something from you comes to call. Each season opens
              with a feast where the whole court gathers.
            </p>
          </section>
          <section>
            <h3>Strangers</h3>
            <p>
              You start knowing almost no one. On the <strong>Court</strong> map, people you have only <strong>heard of</strong> are hooded silhouettes;
              people you have never heard of are not shown at all. You must <strong>see</strong> someone (at court, at a feast, by spying on their
              household) and then be <strong>introduced</strong> before you can talk to them, bribe them or draw them into a scheme. Keep company
              often enough and they become <strong>familiar</strong>: you can read their temperament. Spies can <strong>unmask</strong> their true design.
            </p>
          </section>
          <section>
            <h3>Doors into households</h3>
            <p>
              Servants hear what is said behind closed doors, and a servant who likes you may let it slip. Your wife makes friends among the other
              ladies; that opens doors, and sometimes she comes home with gossip. Set spies on a household to learn who lives there.
            </p>
          </section>
          <section>
            <h3>Motives are hidden</h3>
            <p>
              Everyone shows a face to the court. What they actually want, and whether they mean the oaths they swore, stays hidden until you find out.
              Marriages hide affairs. Brothers hide grudges. Loyal men hide knives.
            </p>
          </section>
          <section>
            <h3>Secrets, belief and proof</h3>
            <p>
              Every secret has two numbers. <strong>Belief</strong> is how far someone credits it. <strong>Proof</strong> is how well it would stand up
              before the King. Whisper what you know, or forge a lie and spread that instead.
            </p>
          </section>
          <section>
            <h3>Schemes</h3>
            <p>
              A <strong>murder</strong> scheme needs preparation and steady hands; even a clean kill may be traced. A <strong>ruin</strong> scheme
              gathers charges and witnesses to lay before the King. When you draw someone in, offer a carrot. They may join sincerely, or meaning to
              betray you. You will not be told which.
            </p>
          </section>
          <section>
            <h3>The King’s justice</h3>
            <p>
              A denunciation is judged on proof, on witnesses, and on whom the King trusts. The accused may be dismissed, sent to the Tower, or sent
              to the block. Prisoners confess or name other names.
            </p>
          </section>
          <section>
            <h3>The Witan</h3>
            <p>
              When the throne falls empty, the Witan meets at the end of the following week. Each lord's voice is weighted by their prestige, and
              they vote for whoever they like, trust, or were promised something by. The Briefing shows how they would vote today. A known
              regicide cannot be chosen.
            </p>
          </section>
          <section>
            <h3>Husbands and wives</h3>
            <p>
              A strong-willed spouse can <strong>goad</strong>, <strong>restrain</strong>, or <strong>demand</strong> a deed. When your wife demands
              something of you, heeding her costs no time.
            </p>
          </section>
          <p className="credit small muted">
            Icons by Lorc, Delapouite and contributors from <a href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a>, CC BY 3.0.
          </p>
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
