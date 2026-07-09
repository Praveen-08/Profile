import { Injectable } from "@nestjs/common";
import { createAnalysisQueue, createRenderQueue } from "@quickreel/queue";
import type {
  AnalyzeProjectJobPayload,
  AnalyzeProjectJobResult,
  RenderVideoJobPayload,
  RenderVideoJobResult,
} from "@quickreel/shared";
import type { Queue } from "bullmq";

@Injectable()
export class QueueService {
  readonly analysisQueue: Queue<AnalyzeProjectJobPayload, AnalyzeProjectJobResult> = createAnalysisQueue();
  readonly renderQueue: Queue<RenderVideoJobPayload, RenderVideoJobResult> = createRenderQueue();

  async enqueueAnalysis(payload: AnalyzeProjectJobPayload): Promise<string> {
    const job = await this.analysisQueue.add("analyze-project", payload);
    return job.id ?? "";
  }

  async enqueueRender(payload: RenderVideoJobPayload): Promise<string> {
    const job = await this.renderQueue.add("render-video", payload);
    return job.id ?? "";
  }
}
