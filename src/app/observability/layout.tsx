import { ObservabilityNav } from "@/components/observability/observability-nav";

export default function ObservabilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <ObservabilityNav />
      {children}
    </div>
  );
}