/** Small "optional" tag shown next to a field label, so editors know the field can stay empty. */
export function Optional() {
  return <span className="ml-1.5 font-normal normal-case tracking-normal text-kf-ink-muted/80">(optional)</span>;
}

/** Form-level note: required fields are marked, everything else may stay empty and is then not shown on the website. */
export function OptionalNote({ required }: { required: string }) {
  return (
    <p
      data-guide="optional-note"
      className="rounded-lg border border-kf-edge bg-kf-surface-sunken px-3 py-2 text-xs text-kf-ink-muted"
    >
      <strong className="text-kf-ink">Pflichtfelder:</strong> {required}. Alle anderen Felder sind{' '}
      <strong className="text-kf-ink">optional</strong>: Was leer bleibt, wird auf der Webseite einfach nicht angezeigt.
    </p>
  );
}
