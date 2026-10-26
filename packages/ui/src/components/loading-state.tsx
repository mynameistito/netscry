interface LoadingStateProps {
  label: string;
  rows?: number;
}

/** Announces loading and reserves space for a small set of data rows. */
/** @returns An accessible status with stable placeholder rows. */
export const LoadingState = ({ label, rows = 3 }: LoadingStateProps) => (
  <output aria-busy="true" aria-label={label} className="block space-y-4">
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }, (_, index) => (
      <div className="flex items-center gap-4" key={`loading-row-${index}`}>
        <div className="bg-muted h-3 w-24 animate-pulse rounded" />
        <div className="bg-muted h-3 flex-1 animate-pulse rounded" />
      </div>
    ))}
  </output>
);
