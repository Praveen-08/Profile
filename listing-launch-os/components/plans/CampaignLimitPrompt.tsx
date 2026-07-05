import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function CampaignLimitPrompt() {
  return (
    <Card className="flex flex-col items-center gap-4 p-16 text-center">
      <p className="font-serif text-xl">You've used your free campaign</p>
      <p className="max-w-md text-sm text-ink/60">
        Upgrade to Starter to create up to 5 campaigns per month, or Pro to unlock meeting playbooks, vendor
        updates, open-home debriefs, and buyer follow-ups.
      </p>
      <div className="flex gap-3">
        <Button href="/#pricing">View Plans</Button>
        <Button href="/dashboard" variant="outline">
          Back to Dashboard
        </Button>
      </div>
    </Card>
  );
}
