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
            <h3>The month</h3>
            <p>
              Each month you have three measures of <strong>time</strong> (the hourglasses). Spend them on deeds. When you end the month, everyone
              else makes their moves. As the next month begins you learn what reached your ears, and anyone who wants something from you comes to
              call. Each season opens with a feast where the whole court gathers.
            </p>
            <p>
              Time passes and people age. Children grow up and the old die, but you and your wife will not die of old age: only a blade, the axe
              or poison can end you.
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
            <p>
              <strong>Keeping company</strong> is how most things are learned. The warmer someone is to you, the more they trust you and the
              looser their tongue, the more they let fall: gossip, a warning of a knife meant for you, a friend to meet, whom they love and
              whom they loathe, what they want. A cunning man gives little away; a hot-headed one gives too much. They never betray their own
              secrets, nor their family's, but an ambition they are hiding may slip out in a careless word.
            </p>
          </section>
          <section>
            <h3>Spies</h3>
            <p>
              A spy is a person: a maid in a lord's house, his brother, his lover, a friend he trusts. Recruit someone close to the one you want
              watched, from their page, and offer them something: a <strong>wage</strong> every month, <strong>their own secret</strong> kept
              quiet, or nothing at all if they are <strong>devoted</strong> to you or <strong>hate</strong> the one they watch. Each month they may
              send word: the schemes their mark is part of, the secrets they keep, what they really want. You can keep three.
            </p>
            <p>
              Spies get caught. A caught spy may name you, and a cunning mark may <strong>turn</strong> them instead: they go on reporting, in
              the same hand, and every word is a lie. A paid or blackmailed spy names you and turns easily; a devoted one rarely. Other lords
              set spies too, some in your own house: <strong>search your household</strong>, and when you find one, send them away or turn
              them and let them carry your forgeries home.
            </p>
          </section>
          <section>
            <h3>Money and standing</h3>
            <p>
              Your lands pay a little. Your <strong>trade</strong> pays more, and decides how the court sees you. Each trade wins or loses
              you <strong>standing</strong> with the Crown, the nobility, the Church, the guilds, the commons and the underworld, and that
              colours how every lord, priest and servant regards you. Estates are honourable; moneylending makes you rich and resented; a
              tax farm pleases the King and enrages the commons. Every trade gives you an edge in intrigue too.
            </p>
            <p>
              A <strong>racket</strong> (a gambling house, a bathhouse, smuggling, forgery) pays best, and is run in secret. Word can get
              out. If it does, it is a scandal and a crime: a secret like any other, to be whispered, used for blackmail, or laid before the
              King. Set up or sell a trade from the Briefing or your own page.
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
              A <strong>murder</strong> scheme needs preparation and steady hands; even a clean kill may be traced. Your cunning and preparation
              hide you, every conspirator is another mouth, and <strong>hired blades</strong> (bought with gold as you work on the scheme) strike
              harder and do it while you are seen elsewhere. A <strong>ruin</strong> scheme
              gathers charges and witnesses to lay before the King. When you draw someone in, offer a carrot. They may join sincerely, or meaning to
              betray you. You will not be told which.
            </p>
            <p>
              You can betray a scheme yourself, whether you joined it or lead it: lay it before the King from your Secrets ("Betray it to the
              King"). Drawing a man into a plot against the King and then handing him over is a fine double-cross. Believed, you are pardoned;
              disbelieved, everyone in it knows what you did.
            </p>
          </section>
          <section>
            <h3>The King’s justice</h3>
            <p>
              If a killing of yours is traced, you are summoned to answer for it before the King: deny it, beg mercy (the Tower for six months
              rather than the axe), accuse your accuser, or run. A denunciation is judged on proof, on witnesses, and on whom the King trusts. The accused may be dismissed, sent to the Tower, or sent
              to the block. Prisoners confess or name other names. Treason and a murder actually done are hanging matters. A charge the King
              dismisses is not forgotten: the hall heard it, the accused's name is muddied, and for a grave charge the King may set his people to
              keep looking. A lord found murdered is looked into too. No one is tried twice for the same crime. If you are thrown in the Tower, you can ask someone to <strong>plead your case</strong> before the King. A spouse or kin is
              likelier to risk it.
            </p>
          </section>
          <section>
            <h3>The Witan</h3>
            <p>
              When the throne falls empty, the Witan meets at the end of the following month. Only men have a voice there, each weighted by his prestige, and
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
            <p>
              <strong>Send your wife to dine</strong> with another lady, from that lady's page, once a month. She comes home with gossip, with
              what the lady's husband wants (an unhappy wife says more), and with faces from that house. A careless wife may say too much of
              your own business, and one who does not care for you may keep things back. Other lords send their wives to dine with yours.
            </p>
            <p>
              Couples have children, and lovers may too: a widow's or a maid's child by her lover is born into her house, and the father is
              told. <strong>Try for a child</strong> with your wife or your lover: it draws her closer, and a child (born nine months on)
              binds her to you as its father. <strong>Acknowledge</strong> a natural child of yours (on the child's page) and they come
              into your house under your name; a son is named your heir. Children grow up, come of age at sixteen, and inherit before their uncles. A child is no part of anyone's
              schemes. A wife with a lover tells him what her husband says at supper, and she may carry his lies home. Watch for letters. A widow
              mourns a year before she is matched again, and for the first half of it no other man courts her. When suitors do call, the whole
              court hears of it, and she takes two months to answer: time enough to make your own offer. A woman who has a lover is not married off to anyone else; your lover will marry no one but you. If you are unwed, <strong>Seek a match</strong> on your own page, or ask for someone's hand on theirs.
            </p>
          </section>
          <section>
            <h3>Love, and following people</h3>
            <p>
              You may <strong>woo any woman as your lover</strong> from her page. That is not marriage: for her hand, use <strong>Ask for her hand</strong>. Her regard for you, your charm and her honour decide it (a widow or a maid has no vow to break, and
              weighs her honour half as much). A woman alone with little to live on looks kindly on a man who can keep her, and you can
              settle crowns on her (paid only if she says yes). A
              wife who loves her husband will not stray. A married lover tells you what her husband says at home. Turned away, she may tell
              him. Other men court other men's wives, yours among them.
            </p>
            <p>
              A widowed or unmarried lover can be <strong>brought into your household</strong> as your mistress. She is devoted and you
              keep her, but the affair is no secret after that: your wife will not forgive it (and may turn on her), honest men and the
              Church think less of you, and her kin feel dishonoured.
            </p>
            <p>
              <strong>Track their movements</strong> to have someone followed for a month: where they go, whom they dine with, and where they slip
              away to after dark. It is how a husband finds his wife's lover, and how a jealous husband may find you. Someone under your own roof
              you can <strong>kill in the night</strong>. It is easily done and hard to explain. A widower may <strong>seek a match</strong> from the
              next month: anyone you know who is free to marry, or a bride from the provinces.
            </p>
          </section>
          <section>
            <h3>A bad end</h3>
            <p>
              The game keeps two earlier places: the <strong>start of this month</strong>, and the <strong>end of the last one</strong>. If you
              die or flee you can turn back to either and choose differently. You can also turn back from the title screen while your game
              goes on. The same choices bring the same results, so do something different.
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
