import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function LockedFeaturePrompt() {
  return (
    <Card className="flex flex-col items-center gap-4 p-16 text-center">
      <Badge>Pro feature</Badge>
      <p className="font-serif text-xl">Unlock Pro tools</p>
      <p className="max-w-md text-sm text-ink/60">
        Agent Meeting Playbooks, Vendor Update Reports, Open Home Debriefs, and Buyer Follow-Up Assistant are
        included in Pro.
      </p>
      <Button href="/#pricing">View Pro Plan</Button>
    </Card>
  );
}
