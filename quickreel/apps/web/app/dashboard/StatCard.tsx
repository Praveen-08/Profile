import { Card } from "@/components/ui/card";

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 truncate font-serif text-2xl font-semibold">{value}</p>
    </Card>
  );
}
