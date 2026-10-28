import { cn } from "@netscry/ui/lib/utils";
import type { ComponentProps } from "react";

// oxlint-disable shadcn/no-arbitrary-values -- actions need a flexible content track and an intrinsic icon track.

interface CardProps extends ComponentProps<"section"> {
  size?: "default" | "sm";
  variant?: "default" | "flush";
}

/** A bordered section for grouping related information.
 * @returns A theme-aware card section.
 */
export const Card = ({
  className,
  size = "default",
  variant = "default",
  ...props
}: CardProps) => (
  <section
    className={cn(
      "bg-card text-card-foreground flex flex-col rounded-xl border text-sm",
      variant === "flush" ? "gap-0 py-0" : "gap-4 p-4 sm:p-5",
      size === "sm" && "gap-3 p-3",
      className
    )}
    data-size={size}
    data-slot="card"
    data-variant={variant}
    {...props}
  />
);

interface CardHeaderProps extends ComponentProps<"div"> {
  bordered?: boolean;
  compact?: boolean;
  variant?: "default" | "with-action";
}

/** Header area for a card, including its title and supporting text.
 * @returns The card header.
 */
export const CardHeader = ({
  bordered = false,
  className,
  compact = false,
  variant = "default",
  ...props
}: CardHeaderProps) => (
  <div
    className={cn(
      variant === "with-action"
        ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
        : "flex flex-col gap-1",
      bordered && "border-border border-b",
      compact && "px-5 py-4 sm:px-6",
      className
    )}
    data-slot="card-header"
    {...props}
  />
);

interface CardTitleProps extends ComponentProps<"h2"> {
  size?: "default" | "sm";
}

/** Primary label for a card.
 * @returns A level-two card heading.
 */
export const CardTitle = ({
  className,
  size = "default",
  ...props
}: CardTitleProps) => (
  // oxlint-disable-next-line jsx-a11y/heading-has-content -- CardTitle receives its accessible title from the caller.
  <h2
    className={cn(
      "leading-snug font-semibold",
      size === "default" ? "text-base" : "text-sm",
      className
    )}
    data-slot="card-title"
    {...props}
  />
);

/** Supporting text for a card title.
 * @returns Muted description text.
 */
export const CardDescription = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="card-description"
    {...props}
  />
);

/** Optional action aligned beside the card header.
 * @returns An action positioned beside the header.
 */
export const CardAction = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn(
      "col-start-2 row-span-2 row-start-1 justify-self-end",
      className
    )}
    data-slot="card-action"
    {...props}
  />
);

interface CardContentProps extends ComponentProps<"div"> {
  divided?: boolean;
  flush?: boolean;
}

/** Main content area for a card.
 * @returns The main card content wrapper.
 */
export const CardContent = ({
  className,
  divided = false,
  flush = false,
  ...props
}: CardContentProps) => (
  <div
    className={cn(
      divided && "divide-border divide-y",
      flush && "px-0 py-0",
      className
    )}
    data-slot="card-content"
    {...props}
  />
);
