import { Brand } from "@/components/Brand";
import { Link } from "react-router";

/**
 * The public footer.
 *
 * One component for the marketing page and the trust pages, so the header and
 * footer offer the same destinations: the four section links (on the landing
 * page), then Privacy, Terms and Contact everywhere.
 */
export function SiteFooter({ sections = false }: { sections?: boolean }) {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Brand />
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.85rem] font-medium text-muted-foreground"
        >
          {sections && (
            <>
              <a href="#pipeline" className="hover:text-brand-ink">
                How it works
              </a>
              <a href="#outputs" className="hover:text-brand-ink">
                What you get
              </a>
              <a href="#workspace" className="hover:text-brand-ink">
                Your workspace
              </a>
              <a href="#questions" className="hover:text-brand-ink">
                FAQ
              </a>
            </>
          )}
          <Link to="/privacy" className="hover:text-brand-ink">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-brand-ink">
            Terms
          </Link>
          <Link to="/contact" className="hover:text-brand-ink">
            Contact
          </Link>
        </nav>
        <p className="text-[0.78rem] text-muted-foreground">
          Small, independent, and built for real revision.
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
