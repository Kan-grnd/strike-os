import { ActivityNav } from "@/components/activity/activity-nav";

export default function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <ActivityNav />
      {children}
    </div>
  );
}
