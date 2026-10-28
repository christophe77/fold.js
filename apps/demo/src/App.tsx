import { useState } from "react";
import { FoldDevtools, TwoPane, useFold } from "@foldjs/react";
import type { Posture } from "@foldjs/react";

type Scene = "mail" | "video" | "map";

const SCENES: Array<{ id: Scene; label: string }> = [
  { id: "mail", label: "Mail" },
  { id: "video", label: "Video" },
  { id: "map", label: "Map" },
];

const HINTS: Record<Posture, string> = {
  flat: "Single screen: panes are stacked. Try “Book” or “Tabletop” in the simulator ↘",
  folded: "Folded, but not split: panes are stacked.",
  book: "Book: each pane gets its own side of the hinge.",
  tabletop: "Tabletop: content on top, controls on the bottom half.",
};

const MAILS = [
  { from: "Ada", subject: "Your app on the Fold", body: "The list stays on the left, the message on the right. Nothing ever lands under the hinge." },
  { from: "Linus", subject: "Re: hinge-aware layouts", body: "One component, every posture. That's the whole pitch." },
  { from: "Grace", subject: "Tabletop mode", body: "Fold it to 90° and the player moves to the top half, controls to the bottom." },
  { from: "Alan", subject: "Works with Vue too", body: "Same core, thin adapters: React, Vue, Svelte, Solid, or plain Web Components." },
];

export function App() {
  const fold = useFold();
  const [scene, setScene] = useState<Scene>("mail");
  const [mail, setMail] = useState(0);

  const header = (
    <header className="top">
      <div className="brand">
        <span className="logo" aria-hidden="true">▯▯</span>
        <span>fold<span className="dot">.js</span></span>
      </div>
      <nav className="tabs" aria-label="Demos">
        {SCENES.map((s) => (
          <button key={s.id} aria-pressed={scene === s.id} onClick={() => setScene(s.id)}>{s.label}</button>
        ))}
      </nav>
      <span className={`chip chip-${fold.posture}`}>{fold.posture}</span>
    </header>
  );

  const scenes = {
    mail: {
      primary: (
        <ul className="list">
          {MAILS.map((m, i) => (
            <li key={m.subject}>
              <button aria-current={i === mail} onClick={() => setMail(i)}>
                <strong>{m.from}</strong>
                <span>{m.subject}</span>
              </button>
            </li>
          ))}
        </ul>
      ),
      secondary: (
        <article className="reader">
          <p className="muted">From {MAILS[mail].from}</p>
          <h2>{MAILS[mail].subject}</h2>
          <p>{MAILS[mail].body}</p>
        </article>
      ),
    },
    video: {
      primary: <div className="stage video"><div className="play" aria-hidden="true">▶</div></div>,
      secondary: (
        <div className="controls">
          <div className="progress"><span style={{ width: "38%" }} /></div>
          <div className="buttons">
            <button aria-label="Previous">⏮</button>
            <button aria-label="Play">▶</button>
            <button aria-label="Next">⏭</button>
          </div>
          <p className="muted">In tabletop posture the video takes the top half, controls stay within thumb reach.</p>
        </div>
      ),
    },
    map: {
      primary: <div className="stage map"><span className="pin" aria-hidden="true">●</span></div>,
      secondary: (
        <article className="reader">
          <h2>Café de la Charnière</h2>
          <p className="muted">4.8 ★ · 350 m · Open until 22:00</p>
          <p>The map never gets cut by the hinge: it lives in its own segment, details in the other.</p>
        </article>
      ),
    },
  }[scene];

  return (
    <>
      <TwoPane
        className="app"
        fallback="stack"
        primary={<section className="pane pane-primary">{header}{scenes.primary}</section>}
        hinge={<div className="hinge-line" />}
        secondary={
          <section className="pane pane-secondary">
            {scenes.secondary}
            <aside className="hint">
              <p>{HINTS[fold.posture]}</p>
              <pre><code>{`<TwoPane\n  primary={<List />}\n  secondary={<Detail />}\n/>`}</code></pre>
            </aside>
          </section>
        }
      />
      <FoldDevtools initial="book" />
    </>
  );
}
