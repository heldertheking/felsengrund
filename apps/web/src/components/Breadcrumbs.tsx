export interface BreadcrumbItem {
  label: string
  href?: string
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-kf-ink-muted">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-kf-accent hover:underline underline-offset-2">
              {item.label}
            </a>
          ) : (
            <span aria-current="page" className="text-kf-ink">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
