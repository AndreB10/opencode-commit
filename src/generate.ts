import type { createOpencodeClient } from "@opencode-ai/sdk";
import type { AgentInfo, ModelRef } from "./types.js";
import { buildCommitPrompt, stripCodeFences } from "./prompt.js";
import type { GitContext } from "./types.js";

type Client = ReturnType<typeof createOpencodeClient>;

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

export async function fetchAgent(
  client: Client,
  agentName: string,
): Promise<AgentInfo | undefined> {
  const { data, error } = await client.app.agents();
  if (error || !Array.isArray(data)) return undefined;

  const agent = data.find((entry) => entry.name === agentName);
  if (!agent) return undefined;

  return {
    name: agent.name,
    model: agent.model
      ? {
          providerID: agent.model.providerID,
          modelID: agent.model.modelID,
        }
      : undefined,
  };
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
  agentName: string;
  agent: AgentInfo;
  context: GitContext;
  userHint?: string;
}): Promise<{ message: string; childSessionID: string; modelLabel: string }> {
  const childSessionID = await createChildSession(
    input.client,
    input.parentSessionID,
  );

  const prompt = buildCommitPrompt(input.context, input.userHint);
  const body: {
    agent: string;
    parts: Array<{ type: "text"; text: string }>;
    model?: ModelRef;
  } = {
    agent: input.agentName,
    parts: [{ type: "text", text: prompt }],
  };

  if (input.agent.model) {
    body.model = input.agent.model;
  }

  const { data: result, error } = await input.client.session.prompt({
    path: { id: childSessionID },
    body,
  });

  if (error) {
    throw new Error(`Sub-agent prompt failed: ${String(error)}`);
  }

  const parts =
    (result as { parts?: Array<{ type?: string; text?: string }> } | undefined)
      ?.parts ?? [];
  const rawText = extractText(parts);

  if (!rawText) {
    throw new Error(
      `Sub-agent returned no text. Child session: ${childSessionID}`,
    );
  }

  return {
    message: stripCodeFences(rawText),
    childSessionID,
    modelLabel: formatModelRef(input.agent.model),
  };
}
