import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
