import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins conditional utility classes and removes conflicting Tailwind classes.
 * @param inputs - Class values to combine.
 * @returns A merged class string.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
