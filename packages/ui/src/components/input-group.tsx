import { Button } from "@netscry/ui/components/button";
import { Input } from "@netscry/ui/components/input";
import { cn } from "@netscry/ui/lib/utils";
import type { ComponentProps } from "react";

interface InputGroupProps extends ComponentProps<"fieldset"> {
  size?: "default" | "lg";
}

/** Groups an input and its related controls into one bordered field.
 * @returns A fieldset containing the grouped controls.
 */
export const InputGroup = ({
  className,
  size = "default",
  ...props
}: InputGroupProps) => (
  <fieldset
    className={cn(
      "border-input bg-background focus-within:border-ring focus-within:ring-ring/40 m-0 flex w-full min-w-0 items-center rounded-md border transition-shadow focus-within:ring-2 has-[:disabled]:opacity-60",
      size === "default" ? "h-9" : "h-10",
      className
    )}
    data-slot="input-group"
    {...props}
  />
);

interface InputGroupAddonProps extends ComponentProps<"div"> {
  align?: "inline-start" | "inline-end";
}

/** Positions a supporting icon or control inside an input group.
 * @returns The supporting adornment.
 */
export const InputGroupAddon = ({
  align = "inline-start",
  className,
  ...props
}: InputGroupAddonProps) => (
  <div
    className={cn(
      "text-muted-foreground flex h-full shrink-0 items-center justify-center gap-2 px-2 [&_svg:not([class*='size-'])]:size-4",
      align === "inline-end" && "order-last",
      className
    )}
    data-align={align}
    data-slot="input-group-addon"
    {...props}
  />
);

type InputGroupButtonProps = Omit<
  ComponentProps<typeof Button>,
  "size" | "variant"
>;

/** A compact button that sits beside the grouped input.
 * @param props - Button options, including its accessible name and action.
 * @returns A ghost button matching the input group.
 */
export const InputGroupButton = (props: InputGroupButtonProps) => (
  <Button
    data-slot="input-group-button"
    size="icon-sm"
    variant="ghost"
    {...props}
  />
);

/** An input styled to sit inside an input group.
 * @param props - Native input attributes such as its name and accessible label.
 * @returns A borderless input that shares its parent's focus treatment.
 */
export const InputGroupInput = (props: ComponentProps<"input">) => (
  <Input data-slot="input-group-control" variant="group" {...props} />
);
