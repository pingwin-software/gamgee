import { Check, Fingerprint, KeyRound } from "lucide-react";
import type { WhatsNewId } from "./whatsNew";

/**
 * The moving picture for each What's new entry: a small piece of Gamgee
 * playing out on a loop (`wn-*` keyframes in WhatsNew.css). The base styles
 * are the end state, because under reduced motion the loops stop.
 */
export default function WhatsNewArt({ demo }: { demo: WhatsNewId }) {
  return (
    <div className="wn-art" aria-hidden="true">
      {demo === "passkeys" && <PasskeysArt />}
    </div>
  );
}

/** A password field ignored, the passkey button pressed, a fingerprint, done. */
function PasskeysArt() {
  return (
    <div className="wn-pk">
      <div className="wn-pk-field">
        <span /><span /><span /><span /><span /><span />
      </div>
      <div className="wn-pk-btn">
        <KeyRound size={13} /> Use a passkey
      </div>
      <div className="wn-pk-scan">
        <Fingerprint size={34} className="wn-pk-print" />
        <span className="wn-pk-ok"><Check size={20} strokeWidth={3} /></span>
      </div>
    </div>
  );
}
