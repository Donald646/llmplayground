import {
  streamText,
  generateText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from "ai";
import { gateway } from "@ai-sdk/gateway";
import { tavilySearch } from "@tavily/ai-sdk";
import { z } from "zod";
import {
  ORCHESTRATOR_SYSTEM,
  DEEP_RESEARCH_SYSTEM,
  CODE_SYSTEM,
  CREATIVE_SYSTEM,
} from "@/lib/chat/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const {
    messages,
    model,
  }: {
    messages: UIMessage[];
    model?: string;
  } = await req.json();

  const orchestratorModel = model || "google/gemini-2.5-flash";

  const result = streamText({
    model: gateway(orchestratorModel),
    system: ORCHESTRATOR_SYSTEM,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      webSearch: tavilySearch({ maxResults: 5 }),

      deepResearchAgent: tool({
        description:
          "Delegate to the deep research specialist for complex questions requiring multiple searches, in-depth analysis, and thorough investigation across multiple angles.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              "The complex research question or topic to investigate thoroughly"
            ),
        }),
        execute: async ({ query }) => {
          const { text, steps } = await generateText({
            model: gateway("google/gemini-2.5-flash"),
            system: DEEP_RESEARCH_SYSTEM,
            prompt: query,
            tools: { webSearch: tavilySearch({ maxResults: 5 }) },
            stopWhen: stepCountIs(5),
          });

          const sources: Array<{
            title: string;
            url: string;
            content: string;
          }> = [];
          for (const step of steps) {
            for (const toolResult of step.toolResults) {
              if (toolResult.toolName === "webSearch") {
                const data = toolResult as unknown as {
                  output: {
                    results?: Array<{
                      title: string;
                      url: string;
                      content: string;
                    }>;
                  };
                };
                const results = data.output?.results ?? [];
                for (const r of results) {
                  if (r.url && r.title) {
                    sources.push({
                      title: r.title,
                      url: r.url,
                      content: r.content ?? "",
                    });
                  }
                }
              }
            }
          }

          return {
            agent: "deepResearch",
            result: text,
            ...(sources.length > 0 && { sources }),
          };
        },
      }),

      codeAgent: tool({
        description:
          "Delegate to the code specialist for programming tasks, code review, debugging, architecture, and technical implementation questions.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              "The programming question, code to review, or technical task"
            ),
        }),
        execute: async ({ query }) => {
          const { text } = await generateText({
            model: gateway("google/gemini-2.5-pro"),
            system: CODE_SYSTEM,
            prompt: query,
          });
          return { agent: "code", result: text };
        },
      }),

      creativeAgent: tool({
        description:
          "Delegate to the creative writing specialist for stories, poetry, brainstorming, copywriting, and other imaginative tasks.",
        inputSchema: z.object({
          query: z
            .string()
            .describe("The creative writing prompt or task description"),
        }),
        execute: async ({ query }) => {
          const { text } = await generateText({
            model: gateway("google/gemini-2.5-flash"),
            system: CREATIVE_SYSTEM,
            prompt: query,
          });
          return { agent: "creative", result: text };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
