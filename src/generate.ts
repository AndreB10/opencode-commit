import type { createOpencodeClient } from "@opencode-ai/sdk";
import type { CommitGroup, CommitRequest, ModelRef } from "./types.js";
import {
  buildCommitPrompt,
  COMMIT_SYSTEM_PROMPT,
  stripCodeFences,
} from "./prompt.js";
import type { GitContext } from "./types.js";

type Client = ReturnType<typeof createOpencodeClient>;
const COMMIT_AGENT = "plan";

function extractText(parts: Array<{ type?: string; text?: string }>): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim();
}

export function formatModelRef(model?: ModelRef): string {
  if (!model) return "default";
  return `${model.providerID}/${model.modelID}`;
}

async function createChildSession(
  client: Client,
  parentSessionID: string,
): Promise<string> {
  const { data: session, error } = await client.session.create({
    body: {
      title: "Commit message",
      parentID: parentSessionID,
    },
  });

  if (error || !session?.id) {
    throw new Error(`Failed to create child session: ${String(error)}`);
  }

  return session.id;
}

export async function generateCommitMessage(input: {
  client: Client;
  parentSessionID: string;
  model: ModelRef;
  context: GitContext;
  request: CommitRequest;
  groups?: CommitGroup[];
}): Promise<{ content: string; childSessionID: string; modelLabel: string }> {
  const childSessionID = await createChildSession(
    input.client,
    input.parentSessionID,
  );

  const prompt = buildCommitPrompt({
    context: input.context,
    request: input.request,
    groups: input.groups,
  });
  const body = {
    agent: COMMIT_AGENT,
    model: input.model,
    system: COMMIT_SYSTEM_PROMPT,
    parts: [{ type: "text" as const, text: prompt }],
  };

  const { data: result, error } = await input.client.session.prompt({
    path: { id: childSessionID },
    body,
  });

  if (error) {
    throw new Error(`Commit prompt failed: ${String(error)}`);
  }

  const parts =
    (result as { parts?: Array<{ type?: string; text?: string }> } | undefined)
      ?.parts ?? [];
  const rawText = extractText(parts);

  if (!rawText) {
    throw new Error(
      `Commit model returned no text. Child session: ${childSessionID}`,
    );
  }

  return {
    content: stripCodeFences(rawText),
    childSessionID,
    modelLabel: formatModelRef(input.model),
  };
}
