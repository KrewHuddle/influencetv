"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <h1 className="mb-2 font-display text-2xl text-itv-magenta">Something went wrong</h1>
        <p className="mb-6 text-sm text-itv-muted">
          An unexpected error occurred.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
