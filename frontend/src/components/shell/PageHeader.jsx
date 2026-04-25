import { useLocation, Link } from "react-router-dom";
import Icon from "../ui/Icon";

/**
 * Page header band — 72px, title + breadcrumbs + optional actions.
 *
 * Usage:
 *   <PageHeader title="المشتريات" icon="shopping_cart">
 *     <button>...</button>  ← right-aligned actions
 *   </PageHeader>
 */
export default function PageHeader({ title, icon, subtitle, children }) {
  const location = useLocation();

  // Build breadcrumbs from pathname
  const segments = location.pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg,
    path: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <div className="h-page-header flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-md bg-accent-light dark:bg-accent-light-dark flex items-center justify-center flex-shrink-0">
            <Icon name={icon} size={22} className="text-accent dark:text-accent-dark" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink dark:text-ink-dark leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted dark:text-muted-dark">{subtitle}</p>
          )}
          {!subtitle && breadcrumbs.length > 1 && (
            <nav className="flex items-center gap-1 text-[12px] text-muted dark:text-muted-dark mt-0.5">
              <Link to="/dashboard" className="hover:text-accent dark:hover:text-accent-dark">
                الرئيسية
              </Link>
              {breadcrumbs.map((bc, i) => (
                <span key={bc.path} className="flex items-center gap-1">
                  <Icon name="chevron_left" size={12} />
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-ink dark:text-ink-dark font-medium">{title}</span>
                  ) : (
                    <Link to={bc.path} className="hover:text-accent dark:hover:text-accent-dark">
                      {bc.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* Right: page actions */}
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
      )}
    </div>
  );
}
