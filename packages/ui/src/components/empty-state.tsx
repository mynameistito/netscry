import type { ReactElement } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactElement;
  action?: ReactElement;
}

/**
 * Explains why a section has no data and what the visitor can do next.
 * @returns A centred explanation with optional icon and action.
 */
export const EmptyState = ({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) => (
  <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
    {icon === undefined ? null : (
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        {icon}
      </div>
    )}
    <div className="max-w-md space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground text-sm leading-6">{description}</p>
    </div>
    {action ?? null}
  </div>
);
