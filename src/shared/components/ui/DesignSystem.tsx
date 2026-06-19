import React from "react";

function classNames(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

type CommonProps = {
  className?: string;
  children: React.ReactNode;
};

export function PageShell({ className, children }: CommonProps) {
  return <div className={classNames("page-shell", className)}>{children}</div>;
}

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={classNames("flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6", className)}>
      <div>
        <h1 className="text-2xl font-bold text-[#5a5c69] mb-1">{title}</h1>
        {description ? <p className="text-sm text-[#858796]">{description}</p> : null}
      </div>
      {actions ? <div className="mt-3 sm:mt-0 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AppTopBar({ className, children }: CommonProps) {
  return <div className={classNames("app-topbar px-4 py-3", className)}>{children}</div>;
}

export function AdminSidebar({ className, children }: CommonProps) {
  return (
    <aside
      className={classNames(
        "surface-card w-full overflow-hidden border-border p-4 md:w-72",
        className,
      )}
    >
      {children}
    </aside>
  );
}

export function StudentSidebar({ className, children }: CommonProps) {
  return (
    <aside
      className={classNames(
        "surface-card w-full overflow-hidden border-border p-4 md:w-72",
        className,
      )}
    >
      {children}
    </aside>
  );
}

type DashboardCardProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

export function DashboardCard({ className, children, ...props }: DashboardCardProps) {
  return (
    <div className={classNames("bg-white shadow-[0_0.15rem_1.75rem_0_rgba(58,59,69,0.15)] rounded-lg mb-4 border border-[#e3e6f0]", className)} {...props}>
      <div className="py-3 px-4 border-b border-[#e3e6f0] font-bold text-[#4e73df]">Title</div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  className?: string;
};

export function StatCard({ title, value, description, className }: StatCardProps) {
  return (
    <div className={classNames("bg-white border-l-[0.25rem] border-[#4e73df] shadow-[0_0.15rem_1.75rem_0_rgba(58,59,69,0.15)] rounded-lg py-2 h-full", className)}>
      <div className="p-4">
        <div className="text-xs font-bold text-[#4e73df] uppercase tracking-wide mb-1">{title}</div>
        <div className="text-xl font-bold text-[#5a5c69] mb-0">{value}</div>
        {description ? <div className="text-xs text-[#858796] mt-2">{description}</div> : null}
      </div>
    </div>
  );
}

export function DataTable({ className, children }: CommonProps) {
  return <div className={classNames("data-table overflow-x-auto", className)}>{children}</div>;
}

export function FilterBar({ className, children }: CommonProps) {
  return <div className={classNames("filter-bar", className)}>{children}</div>;
}

export function FormPanel({ title, children, className }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={classNames("form-panel surface-card", className)}>
      {title ? <h2 className="form-panel-title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, description, actions, className }: { title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={classNames("bg-white shadow-[0_0.15rem_1.75rem_0_rgba(58,59,69,0.15)] rounded-lg p-10 flex flex-col items-center justify-center text-center", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f8f9fc] text-[#4e73df] mb-4">
        <InfoIcon className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-[#5a5c69] mb-2">{title}</h3>
      {description ? <p className="text-sm text-[#858796] max-w-md">{description}</p> : null}
      {actions ? <div className="mt-6">{actions}</div> : null}
    </div>
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={classNames("h-6 w-6", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function ResourceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={classNames("h-5 w-5", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M8.5 12.4 13 7.9a3.1 3.1 0 0 1 4.4 4.4l-6.7 6.7a4.4 4.4 0 0 1-6.2-6.2l7.1-7.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={classNames("h-6 w-6", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M7 3.75h6.4L18 8.35v12.9H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13.25 4v4.5h4.5M9.5 13h5M9.5 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TranscriptIcon({ className }: { className?: string }) {
  return (
    <svg
      className={classNames("h-5 w-5", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 5.5h14v9.75H9.4L5 18.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 9h8M8 12h5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export type StatusBannerVariant = "success" | "warning" | "error" | "info";

export function StatusBanner({
  variant = "info",
  title,
  description,
  icon,
  className,
}: {
  variant?: StatusBannerVariant;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const liveRole = variant === "error" ? "alert" : "status";

  return (
    <div className={classNames("status-banner", `status-banner--${variant}`, className)} role={liveRole}>
      {icon ? <div className="status-banner-icon">{icon}</div> : null}
      <div>
        <p className="font-semibold text-brand-on-background">{title}</p>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="confirm-dialog-backdrop" aria-hidden="true" />
      <div
        className={classNames("confirm-dialog-panel surface-card", className)}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h2>
        {description ? <p id="confirm-dialog-description" className="confirm-dialog-description">{description}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
