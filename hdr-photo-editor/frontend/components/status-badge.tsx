import { Badge } from "@/components/ui/badge";
import type { GroupStatus, ProcessingStatus } from "@/lib/types";

const STATUS_LABEL: Record<GroupStatus, string> = {
  HDR_READY: "HDR Ready",
  SINGLE_EDIT: "Single Edit",
  NEEDS_REVIEW: "Needs Review",
};

const STATUS_VARIANT: Record<GroupStatus, "success" | "default" | "warning"> = {
  HDR_READY: "success",
  SINGLE_EDIT: "default",
  NEEDS_REVIEW: "warning",
};

export function GroupStatusBadge({ status }: { status: GroupStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const PROCESSING_LABEL: Record<ProcessingStatus, string> = {
  PENDING: "Not processed",
  QUEUED: "Queued",
  PROCESSING: "Processing…",
  DONE: "Done",
  FAILED: "Failed",
};

const PROCESSING_VARIANT: Record<ProcessingStatus, "outline" | "default" | "success" | "danger"> = {
  PENDING: "outline",
  QUEUED: "default",
  PROCESSING: "default",
  DONE: "success",
  FAILED: "danger",
};

export function ProcessingStatusBadge({ status }: { status: ProcessingStatus }) {
  return <Badge variant={PROCESSING_VARIANT[status]}>{PROCESSING_LABEL[status]}</Badge>;
}
