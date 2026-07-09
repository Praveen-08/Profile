import { Card } from "@/components/ui/card";
import type { ReelScore } from "@/lib/api";

const SUB_SCORES: { key: keyof ReelScore; label: string }[] = [
  { key: "storytellingScore", label: "Storytelling" },
  { key: "beatSyncScore", label: "Beat Sync" },
  { key: "luxuryScore", label: "Luxury" },
  { key: "motionQualityScore", label: "Motion Quality" },
  { key: "viewerRetentionPrediction", label: "Retention Prediction" },
  { key: "socialMediaScore", label: "Social Media Fit" },
];

function scoreColor(value: number): string {
  if (value >= 80) return "bg-accent";
  if (value >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

export function ReelScoreCard({ score }: { score: ReelScore }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">AI Reel Score</h2>
        <span className="font-serif text-3xl font-semibold text-accent">{score.overallScore}</span>
      </div>

      <div className="space-y-3">
        {SUB_SCORES.map(({ key, label }) => {
          const value = score[key] as number;
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${scoreColor(value)}`} style={{ width: `${value}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {score.recommendations.length > 0 && (
        <div className="mt-5 space-y-1.5 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommendations</p>
          {score.recommendations.map((rec, i) => (
            <p key={i} className="text-sm text-muted">
              · {rec}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
