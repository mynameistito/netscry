import type { ReactNode } from "react";

interface DataFieldProps {
  label: string;
  value: ReactNode;
  description?: string;
  mono?: boolean;
}

/**
 * Displays one clearly labelled value in a compact data grid.
 * @returns A semantic label/value pair with optional supporting text.
 */
export const DataField = ({
  label,
  value,
  description,
  mono = false,
}: DataFieldProps) => (
  <div className="min-w-0 space-y-1">
    <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
    <dd className={mono ? "truncate font-mono text-sm" : "truncate text-sm"}>
      {value}
    </dd>
    {description === undefined ? null : (
      <p className="text-muted-foreground text-xs">{description}</p>
    )}
  </div>
);
