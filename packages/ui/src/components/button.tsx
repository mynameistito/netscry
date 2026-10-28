import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@netscry/ui/lib/utils";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const buttonVariants = cva(
  "focus-visible:outline-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground border",
        ghost: "hover:bg-muted hover:text-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-5",
        "icon-xl": "size-10 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

interface ButtonProps
  extends
    ComponentProps<typeof ButtonPrimitive>,
    VariantProps<typeof buttonVariants> {}

/** A theme-aware button with standard NetScry variants.
 * @returns A styled button primitive.
 */
export const Button = ({ className, size, variant, ...props }: ButtonProps) => (
  <ButtonPrimitive
    className={cn(buttonVariants({ className, size, variant }))}
    data-slot="button"
    {...props}
  />
);
