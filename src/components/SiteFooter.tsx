import { Brand } from "@/components/Brand";
import { Link } from "react-router";

/**
 * The public footer. One compact rule, three legal links and the section
 * anchors — no second navigation system.
 */
export function SiteFooter({ sections = false }: { sections?: boolean }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Brand />
        <nav aria-label="Footer" className="site-footer-links">
          {sections && (
            <>
              <a href="#how">How it works</a>
              <a href="#moments">What you get</a>
            </>
          )}
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <p className="site-footer-note">Built for real revision.</p>
      </div>
    </footer>
  );
}

export default SiteFooter;
