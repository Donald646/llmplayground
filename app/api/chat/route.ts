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

export const maxDuration = 60;

const ORCHESTRATOR_SYSTEM = `You are an intelligent orchestrator that coordinates specialist tools and agents to answer user queries effectively.

You have access to these tools:
- **webSearch**: For quick factual lookups, current events, and verifying information. Call this directly — you'll get search results back and should synthesize them into your response with inline citations.
- **deepResearchAgent**: For complex research questions requiring multiple searches, in-depth analysis, and thorough investigation. Delegates to a research specialist who performs multi-step research.
- **codeAgent**: For programming tasks, code review, debugging, architecture questions, and technical implementation.
- **creativeAgent**: For creative writing, brainstorming, storytelling, poetry, and imaginative tasks.

**Guidelines:**
- For simple greetings or trivial questions, answer directly without calling any tool.
- For quick factual questions or current events, use webSearch directly.
- For complex research requiring deep analysis with multiple angles, use deepResearchAgent.
- For programming tasks, use codeAgent. For creative tasks, use creativeAgent.
- You may call multiple tools if the query spans multiple domains.
- You MUST ALWAYS write a final text response after receiving tool results. NEVER stop after a tool call — you must synthesize the results into your own well-structured reply.

**Citation rules (CRITICAL — follow exactly):**
- When you use webSearch results, cite sources using numbered markers [1], [2], etc. Number sources in the order you first reference them.
- Place each citation immediately after the claim it supports, e.g.: "Quantum computers use qubits [1] which can exist in superposition [2]."
- Do NOT group citations at the end of a paragraph like [1, 2, 3]. Keep them inline after each individual claim.
- Do NOT add a "References" or "Sources" section at the end.
- If deepResearchAgent returns text with citations, preserve them exactly as-is in your response.`;

const deepResearchSystemPrompt = `You are a deep research specialist. You conduct thorough, multi-faceted investigations.
- Perform multiple searches to gather comprehensive information from different angles
- Cross-reference sources for accuracy
- Provide in-depth analysis with nuance and context
- Structure findings clearly with key insights
- Note areas of uncertainty or debate

You MUST use the webSearch tool to research. Never answer from memory alone. For complex topics, perform multiple searches with different queries to build a complete picture.

After searching, cite your sources:
- Place citations INLINE immediately after each claim, like: "AI has transformed healthcare [1] and finance [2]."
- Use the format [1], [2], [3] etc. Number sources in the order you first reference them.
- Do NOT write a "References" or "Sources" section at the end. Only use inline [N] markers.
- Each citation should appear right after the specific sentence or claim it supports, NOT grouped at the end of a paragraph.`;

const codeSystemPrompt = `You are a senior software engineer. Provide expert programming assistance.
- Write clean, idiomatic, production-quality code
- Explain your reasoning and trade-offs
- Consider edge cases and error handling
- Follow best practices for the relevant language/framework
- Include brief explanations alongside code`;

const creativeSystemPrompt = `You are a creative writing specialist. Produce engaging, imaginative content.
- Write with vivid language and strong voice
- Adapt tone and style to the request
- Be original and surprising
- Structure creative pieces well
- Balance creativity with clarity`;

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
            system: deepResearchSystemPrompt,
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
            system: codeSystemPrompt,
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
            system: creativeSystemPrompt,
            prompt: query,
          });
          return { agent: "creative", result: text };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
