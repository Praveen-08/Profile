export function Footer() {
  return (
    <footer className="border-t border-ink/10 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center text-sm text-ink/50">
        <p>© {new Date().getFullYear()} Listing Launch. Built for NZ real estate agents.</p>
        <p>Built by an Auckland real estate media operator, currently testing with NZ agents.</p>
        <p>Marketing copy is a drafting aid — agents remain responsible for accuracy and compliance before publishing.</p>
      </div>
    </footer>
  );
}
