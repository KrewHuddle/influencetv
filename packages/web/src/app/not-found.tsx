import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="font-display text-6xl italic text-white/10">404</p>
        <h1 className="mb-2 mt-2 font-display text-2xl">Not found</h1>
        <p className="mb-6 text-sm text-itv-muted">
          This page doesn&apos;t exist.
        </p>
        <Link href="/"><Button>Go Home</Button></Link>
      </div>
    </div>
  );
}
