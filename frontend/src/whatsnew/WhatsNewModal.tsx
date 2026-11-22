import { useEffect, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import WhatsNewArt from "./WhatsNewArt";
import { WHATS_NEW_COPY, type WhatsNewEntry } from "./whatsNew";
import "./WhatsNew.css";

/** `**words**` in bold. */
function rich(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

/**
 * What's new: one page per entry (its moving picture, a title, a few lines),
 * stepped with Next and Back. Nothing jumps between pages: every page's words
 * share one grid cell and Back keeps its slot on the first page.
 */
export default function WhatsNewModal({ entries, onClose }: {
  entries: readonly WhatsNewEntry[];
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const entry = entries[Math.min(page, entries.length - 1)];
  if (!entry) return null;
  const last = page >= entries.length - 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card wn-modal"
        role="dialog"
        aria-modal="true"
        aria-label="What's new"
        onClick={e => e.stopPropagation()}
      >
        <div className="wn-heading"><Sparkles size={12} /> What's new</div>
        {/* Keyed, so each page's animation starts from the top. */}
        <WhatsNewArt key={entry.id} demo={entry.id} />
        <div className="wn-cell">
          {entries.map(item => {
            const current = item.id === entry.id;
            const copy = WHATS_NEW_COPY[item.id];
            return (
              <article
                key={item.id}
                className={`wn-page${current ? "" : " is-ghost"}`}
                aria-hidden={current ? undefined : true}
              >
                <h3 className="wn-title">{copy.title}</h3>
                <p className="wn-body">{rich(copy.body)}</p>
              </article>
            );
          })}
        </div>
        <div className="wn-foot">
          <button
            className={`btn-secondary${page === 0 ? " is-ghost" : ""}`}
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Back
          </button>
          <span className="wn-step">
            {entries.length > 1 ? `${page + 1} of ${entries.length}` : null}
          </span>
          <button className="btn-primary" autoFocus onClick={last ? onClose : () => setPage(page + 1)}>
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
