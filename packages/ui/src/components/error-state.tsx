import { useId } from "react";
import type { ReactElement } from "react";

interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactElement;
}

/**
 * Presents a recoverable error with an accessible alert announcement.
 * @returns An accessible alert with an optional recovery action.
 */
export const ErrorState = ({ title, description, action }: ErrorStateProps) => {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="border-destructive/30 bg-destructive/5 rounded-lg border p-5"
      role="alert"
    >
      <h2 className="text-sm font-medium" id={titleId}>
        {title}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-6">
        {description}
      </p>
      {action === undefined ? null : <div className="mt-4">{action}</div>}
    </section>
  );
};
