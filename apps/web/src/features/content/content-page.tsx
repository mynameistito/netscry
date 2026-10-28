import type { ReactNode } from "react";

import { AppShell } from "../shell/app-shell";

/** A centered reading layout for explanatory and policy pages.
 * @returns The shared site shell with a readable content column.
 */
export const ContentPage = ({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) => (
  <AppShell>
    <main className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-muted-foreground text-caption font-medium tracking-wide uppercase">
          {eyebrow}
        </p>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="text-muted-foreground text-base leading-7">
          {description}
        </p>
      </header>
      <article className="space-y-8 text-base leading-7">{children}</article>
    </main>
  </AppShell>
);
