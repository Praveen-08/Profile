import { ROOM_TYPES, RoomTypeSchema, type RoomType } from "@quickreel/shared";
import { z } from "zod";
import { clamp01 } from "../util.js";

export interface OpenAiClassification {
  roomType: RoomType;
  confidence: number;
  /** The model's own luxury-appeal judgment, 0..1 — overrides the heuristic proxy when present. */
  luxuryAppeal: number;
  isOutdoor: boolean;
  isTwilight: boolean;
}

const ResponseSchema = z.object({
  roomType: RoomTypeSchema,
  confidence: z.number().min(0).max(1),
  luxuryAppeal: z.number().min(0).max(1),
  isOutdoor: z.boolean(),
  isTwilight: z.boolean(),
});

export interface OpenAiVisionConfig {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

const SYSTEM_PROMPT = `You are a real estate photography analyst. Classify a single listing photo.
Respond only with the requested JSON. Never invent details not visible in the image.`;

/**
 * Real OpenAI Vision call (Chat Completions with a structured JSON schema
 * response) — used whenever OPENAI_API_KEY is configured. Classifies the
 * room type from the full ${ROOM_TYPES.length}-value catalog and judges
 * luxury appeal directly, which the heuristic adapter cannot do.
 */
export async function classifyRoomOpenAI(imageBuffer: Buffer, config: OpenAiVisionConfig): Promise<OpenAiClassification> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Classify this real estate photo's room type as exactly one of: ${ROOM_TYPES.join(", ")}. Also rate its luxury appeal (0-1), and note whether it is an outdoor/twilight shot.`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "room_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              roomType: { type: "string", enum: ROOM_TYPES },
              confidence: { type: "number" },
              luxuryAppeal: { type: "number" },
              isOutdoor: { type: "boolean" },
              isTwilight: { type: "boolean" },
            },
            required: ["roomType", "confidence", "luxuryAppeal", "isOutdoor", "isTwilight"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI vision request failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const content = json.choices[0]?.message.content;
  if (!content) throw new Error("OpenAI vision response had no content");

  const parsed = ResponseSchema.parse(JSON.parse(content));
  return {
    roomType: parsed.roomType,
    confidence: clamp01(parsed.confidence),
    luxuryAppeal: clamp01(parsed.luxuryAppeal),
    isOutdoor: parsed.isOutdoor,
    isTwilight: parsed.isTwilight,
  };
}
