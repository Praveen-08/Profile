export function Footer() {
  return (
    <footer className="border-t border-ink/10 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-ink/50 sm:flex-row">
        <p>© {new Date().getFullYear()} Listing Launch OS. Built for Auckland &amp; New Zealand real estate agents.</p>
        <p>Marketing copy is a drafting aid — agents remain responsible for accuracy and compliance before publishing.</p>
      </div>
    </footer>
  );
}
