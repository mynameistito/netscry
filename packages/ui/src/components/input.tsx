import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@netscry/ui/lib/utils";
import type { ComponentProps } from "react";

interface InputProps extends ComponentProps<"input"> {
  variant?: "default" | "group";
}

/** A theme-aware text input with a visible keyboard focus state.
 * @returns A styled input primitive.
 */
export const Input = ({
  className,
  type,
  variant = "default",
  ...props
}: InputProps) => (
  <InputPrimitive
    className={cn(
      "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-9 w-full min-w-0 border bg-transparent py-1 text-base shadow-xs transition-colors outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm",
      variant === "default" && "rounded-md px-3",
      variant === "group" &&
        "h-full flex-1 rounded-none border-0 px-1 shadow-none focus-visible:ring-0",
      className
    )}
    data-slot="input"
    type={type}
    {...props}
  />
);
