import { FOOTER } from "@/lib/site/content";
import { Prose } from "@/components/site/primitives/Prose";
import { SiteRule } from "@/components/site/primitives/SiteRule";

// The site footer: dense, structured, left-aligned. Two columns at md and
// up (identity + contact), stacked on mobile, with the fictional-data note
// and the copyright on a bottom row. The note line is a hard honesty
// constraint and always renders visibly.

const mono = {
  fontFamily: "var(--site-font-mono)",
  fontSize: "var(--site-t-label)",
  letterSpacing: "0.02em",
} as const;

export default function SiteFooter() {
  return (
    <footer>
      <SiteRule strong />
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--site-max)",
          paddingInline: "var(--site-gutter)",
          paddingBlock: "var(--site-sp-5)",
        }}
      >
        <div className="grid grid-cols-1 gap-y-[var(--site-sp-4)] md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-[var(--site-sp-5)]">
          <div>
            <div
              className="uppercase"
              style={{
                fontFamily: "var(--site-font-mono)",
                fontSize: "var(--site-t-label)",
                letterSpacing: "var(--site-ls-label)",
                color: "var(--site-fg)",
              }}
            >
              {FOOTER.wordmark}
            </div>
            <Prose dim className="mt-[var(--site-sp-2)]">
              {FOOTER.positioning}
            </Prose>
          </div>
          <div className="flex flex-col items-start gap-[var(--site-sp-1)]">
            <a
              href={`mailto:${FOOTER.email}`}
              style={{ ...mono, color: "var(--site-fg)" }}
            >
              {FOOTER.email}
            </a>
            <a
              href={FOOTER.github}
              target="_blank"
              rel="noopener"
              style={{ ...mono, color: "var(--site-fg)" }}
            >
              {FOOTER.githubLabel}
            </a>
          </div>
        </div>
        <SiteRule className="my-[var(--site-sp-4)]" />
        <div className="flex flex-col gap-[var(--site-sp-1)] md:flex-row md:items-baseline md:justify-between md:gap-x-[var(--site-sp-4)]">
          <p className="m-0" style={{ ...mono, color: "var(--site-fg-dim)" }}>
            {FOOTER.note}
          </p>
          <p className="m-0" style={{ ...mono, color: "var(--site-fg-dim)" }}>
            {FOOTER.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
