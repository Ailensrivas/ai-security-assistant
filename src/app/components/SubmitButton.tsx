"use client";

import { useFormStatus } from "react-dom";

/** A submit button that disables itself and shows `pendingLabel` while the action runs. */
export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-brand text-white hover:bg-brand/90",
    secondary: "border border-border bg-card text-foreground hover:bg-background",
    ghost: "text-muted underline-offset-2 hover:underline",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ${styles}`}
    >
      {pending ? (pendingLabel ?? label) : label}
    </button>
  );
}
