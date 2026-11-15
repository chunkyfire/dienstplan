import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logout, type Me } from "@/lib/suite.functions";

type Tab = "aktuell" | "planung" | "einstellungen";

/** One bar on every page: switch between the live plan and planning without leaving the app. */
export function SuiteTabs({ active, me }: { active: Tab; me: Me | null }) {
  const router = useRouter();
  const logoutFn = useServerFn(logout);
  const cls = (t: Tab) => `suite-tab ${active === t ? "is-active" : ""}`;
  return (
    <nav className="suite-tabs" aria-label="Bereiche">
      <div className="suite-tabs-inner">
        <Link to="/" className={cls("aktuell")}>Aktuell</Link>
        <Link to="/planung" className={cls("planung")}>Planung</Link>
        {me && <Link to="/einstellungen" className={cls("einstellungen")}>Einstellungen</Link>}
        <a href="./Dienstplan_Handbuch.pdf" target="_blank" rel="noreferrer" className="suite-tab">Handbuch</a>
        <span className="suite-user">
          {me ? (
            <>
              <span>{me.name}</span>
              <button className="btn-plain btn-sm" onClick={async () => { await logoutFn(); await router.invalidate(); }}>Abmelden</button>
            </>
          ) : (
            <Link to="/planung" className="btn-plain btn-sm">Anmelden</Link>
          )}
        </span>
      </div>
    </nav>
  );
}
