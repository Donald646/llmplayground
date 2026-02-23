# Research Report: Vercel AI SDK — generateText, Tool Calling, Provider Switching, Agent Patterns
Generated: 2026-02-10

## Summary

The Vercel AI SDK (npm package `ai`, currently at v6.x) provides a unified API for text generation, tool calling, structured output, and agent loops across 25+ LLM providers. Your codebase already uses AI SDK 6 patterns effectively (`gateway()`, `Output.object()`, `tool()`, `stopWhen`, `stepCountIs`). This report documents the full API surface for these features, including the newer `ToolLoopAgent` class and `prepareStep` for dynamic per-step model switching.

## Questions Answered

### Q1: How to use generateText() with tool calling
**Answer:** Pass a `tools` object to `generateText()`. Each tool is created with the `tool()` helper, which takes a `description`, `inputSchema` (Zod schema), and an `execute` async function. For multi-step loops, add `stopWhen: stepCountIs(N)` so the model can call tools, receive results, and continue reasoning.
**Source:** https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
**Confidence:** High (verified against your existing codebase which already uses this pattern)

### Q2: How to swap providers (anthropic, openai, google)
**Answer:** Two approaches: (1) Use `@ai-sdk/gateway` with string format `"provider/model"` (e.g., `"anthropic/claude-sonnet-4-20250514"`, `"openai/gpt-4o"`, `"google/gemini-2.5-flash"`). This is the simplest and what your codebase already uses. (2) Use individual provider packages (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`) with factory functions for custom configuration.
**Source:** https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
**Confidence:** High

### Q3: How to structure tools for the AI to call
**Answer:** Tools use Zod schemas for type-safe input validation. The `tool()` helper enforces the shape. Tools with `execute` functions auto-run; tools without `execute` return the tool call for manual handling. Use `.describe()` on Zod fields to guide the LLM.
**Source:** https://ai-sdk.dev/docs/foundations/tools
**Confidence:** High

### Q4: Best patterns for agent-style usage with structured decisions
**Answer:** Combine `generateText()` + `tools` + `Output.object()` + `stopWhen`. The model runs a tool loop (calling tools, receiving results), then produces a final structured output matching your Zod schema. For reusable agents, AI SDK 6 introduces `ToolLoopAgent`. For dynamic model/tool changes per step, use `prepareStep`.
**Source:** https://vercel.com/blog/ai-sdk-6
**Confidence:** High

## Detailed Findings

### Finding 1: generateText() with Tools — Complete API

**Source:** https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text

**Core Pattern:**

```typescript
import { generateText, tool, stepCountIs } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';

const { text, toolCalls, toolResults, steps } = await generateText({
  model: gateway('anthropic/claude-sonnet-4-20250514'),
  system: 'You are a helpful assistant.',
  prompt: 'What is the weather in SF?',

  // Tool definitions
  tools: {
    getWeather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).optional(),
      }),
      execute: async ({ location, unit }) => {
        // Your implementation here
        return { temperature: 72, condition: 'sunny', location };
      },
    }),
  },

  // Multi-step: allow up to N steps of tool-call-then-continue
  stopWhen: stepCountIs(5),
});
```

**Key return values:**
- `text` — final text response
- `toolCalls` — array of tool calls from the last step
- `toolResults` — results from the last step's tool executions
- `steps` — array of all steps (each with its own text, toolCalls, toolResults)
- `output` — structured output (when using `Output.object()`)

### Finding 2: Provider Switching Patterns

**Source:** https://ai-sdk.dev/providers/ai-sdk-providers

**Approach A: Gateway (string-based) — RECOMMENDED for your codebase**

```typescript
import { gateway } from '@ai-sdk/gateway';

// Switch providers by changing the string
const model = gateway('anthropic/claude-sonnet-4-20250514');
const model = gateway('openai/gpt-4o');
const model = gateway('google/gemini-2.5-flash');
const model = gateway('google/gemini-2.5-pro');

// Use in generateText or streamText
const { text } = await generateText({ model, prompt: '...' });
```

Your codebase already uses this pattern via `@ai-sdk/gateway`. The gateway routes through Vercel's AI Gateway, which handles provider-specific API differences.

**Approach B: Direct provider packages (for custom config)**

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Custom configuration per provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // custom headers, baseURL, etc.
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// Use specific models
const model = anthropic('claude-sonnet-4-20250514');
const model = openai('gpt-4o');
const model = google('gemini-2.5-flash');
```

**Approach C: Dynamic model selection with a registry/map**

```typescript
import { gateway } from '@ai-sdk/gateway';

const MODEL_MAP = {
  fast: 'google/gemini-2.5-flash',
  smart: 'anthropic/claude-sonnet-4-20250514',
  code: 'google/gemini-2.5-pro',
  creative: 'anthropic/claude-sonnet-4-20250514',
} as const;

function getModel(task: keyof typeof MODEL_MAP) {
  return gateway(MODEL_MAP[task]);
}
```

### Finding 3: Tool Structure — Full Definition

**Source:** https://ai-sdk.dev/docs/foundations/tools

```typescript
import { tool } from 'ai';
import { z } from 'zod';

// Full tool definition
const analyzeData = tool({
  // Description tells the LLM when/how to use this tool
  description: 'Analyze a dataset and return statistical summary',

  // Zod schema defines + validates the input
  inputSchema: z.object({
    data: z.array(z.number()).describe('Array of numeric values'),
    metric: z.enum(['mean', 'median', 'mode']).describe('Which metric to compute'),
  }),

  // execute runs automatically when the LLM calls this tool
  execute: async ({ data, metric }) => {
    // Your logic here
    const result = computeMetric(data, metric);
    return { metric, value: result, count: data.length };
  },
});

// Tool WITHOUT execute — returns tool call for manual handling
const confirmAction = tool({
  description: 'Request user confirmation before proceeding',
  inputSchema: z.object({
    action: z.string(),
    details: z.string(),
  }),
  // No execute — the tool call is returned in the result for you to handle
});
```

**Best practices for tool schemas:**
- Use `.describe()` on every field — the LLM reads these
- Use `z.enum()` for constrained choices
- Keep schemas focused — one tool per action
- Return structured objects from execute, not raw strings

### Finding 4: Agent Pattern with Structured Output

**Source:** https://vercel.com/blog/ai-sdk-6, https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data

**Pattern: Tool loop + structured final output**

This is the most powerful pattern for "AI analyzes data and returns a structured decision":

```typescript
import { generateText, tool, Output, stepCountIs } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';

// Define the structured output schema
const decisionSchema = z.object({
  recommendation: z.enum(['approve', 'reject', 'escalate']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  factors: z.array(z.object({
    name: z.string(),
    weight: z.number(),
    assessment: z.string(),
  })),
});

const { output } = await generateText({
  model: gateway('anthropic/claude-sonnet-4-20250514'),
  system: 'You are a decision analyst. Use the provided tools to gather data, then make a structured recommendation.',
  prompt: 'Evaluate application #12345',

  tools: {
    fetchApplicationData: tool({
      description: 'Fetch the application details',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        return await db.getApplication(id);
      },
    }),
    checkCreditScore: tool({
      description: 'Check credit score for an applicant',
      inputSchema: z.object({ applicantId: z.string() }),
      execute: async ({ applicantId }) => {
        return await creditService.check(applicantId);
      },
    }),
    getHistoricalData: tool({
      description: 'Get historical performance data',
      inputSchema: z.object({ category: z.string() }),
      execute: async ({ category }) => {
        return await analytics.getHistory(category);
      },
    }),
  },

  // Structured output — the model's final response must match this schema
  output: Output.object({ schema: decisionSchema }),

  // Allow up to 10 steps of tool calling before final output
  stopWhen: stepCountIs(10),
});

// output is fully typed: { recommendation, confidence, reasoning, factors }
console.log(output?.recommendation); // 'approve' | 'reject' | 'escalate'
```

**Important:** When using `output` with tool calling, the structured output generation counts as an additional step. So if you set `stepCountIs(5)`, the model has 4 steps for tools and 1 for the final structured response.

### Finding 5: ToolLoopAgent (AI SDK 6)

**Source:** https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent

```typescript
import { ToolLoopAgent } from 'ai';
import { gateway } from '@ai-sdk/gateway';

const agent = new ToolLoopAgent({
  model: gateway('anthropic/claude-sonnet-4-20250514'),
  system: 'You are an agent with access to tools.',
  tools: {
    // ... your tools
  },
  // Default: stopWhen: stepCountIs(20)
});

// Use the agent
const result = await agent.generate({
  prompt: 'Analyze this data and give me a recommendation.',
});

// Or with structured output
const result = await agent.generate({
  prompt: 'Analyze this data.',
  output: Output.object({ schema: mySchema }),
});
```

`ToolLoopAgent` is a reusable, class-based wrapper around the `generateText` + tool loop pattern. Define once, use many times.

### Finding 6: prepareStep for Dynamic Model/Tool Switching

**Source:** https://ai-sdk.dev/docs/agents/loop-control

```typescript
const result = await generateText({
  model: gateway('google/gemini-2.5-flash'), // default model
  prompt: 'Complex multi-step task',
  tools: { /* ... */ },
  stopWhen: stepCountIs(10),

  // Runs before each step — can override model, tools, system prompt
  prepareStep: async ({ stepNumber, previousSteps }) => {
    // Example: switch to a more powerful model for later reasoning steps
    if (stepNumber > 3) {
      return {
        model: gateway('anthropic/claude-sonnet-4-20250514'),
      };
    }
    // Return undefined or {} to keep defaults
    return {};
  },
});
```

This enables cost optimization: use a cheap model for initial tool gathering, then switch to a powerful model for final synthesis.

## Your Codebase — Current Usage Analysis

Your project at `/Users/donaldchu/dev/chatapp` already uses AI SDK 6 effectively:

| File | Pattern Used |
|------|-------------|
| `app/api/chat/route.ts` | `streamText` + `tool()` + `stopWhen(stepCountIs(5))` — orchestrator agent delegating to specialist sub-agents via `generateText` inside tool execute functions |
| `app/api/games/match/route.ts` | `streamText` + `tool()` + `stopWhen(stepCountIs(5))` — game master calling `getResponse` tool for each contestant |
| `app/api/games/wordle/turn/route.ts` | `generateText` + `Output.object()` — structured output (guess + message) |
| `app/api/games/wordle-shared/turn/route.ts` | Same pattern as wordle turn |

**Packages installed:** `ai@^6.0.77`, `@ai-sdk/gateway@^3.0.39`, `@ai-sdk/google@^3.0.22`, `zod@^4.3.6`

**Note:** You have `@ai-sdk/google` installed but your code exclusively uses `@ai-sdk/gateway` with string model IDs. The `@ai-sdk/google` package may be unused unless referenced elsewhere.

## Recommendations

### For This Codebase

1. **Your gateway pattern is already ideal.** Using `gateway("provider/model")` strings makes provider switching trivial. No changes needed.

2. **Consider `Output.object()` for the match route.** Currently the match route (`/api/games/match/route.ts`) parses the winner via a `RESULT:{json}` string convention. Using `Output.object()` with a result schema would be more robust:
   ```typescript
   output: Output.object({
     schema: z.object({
       winner: z.enum(['A', 'B', 'draw']),
       scoreA: z.number(),
       scoreB: z.number(),
       reasoning: z.string(),
     }),
   }),
   ```

3. **Consider `prepareStep` for the orchestrator.** Your chat route currently hardcodes `google/gemini-2.5-flash` for research/creative agents and `google/gemini-2.5-pro` for code. With `prepareStep`, you could make the sub-agent model configurable per step.

4. **`ToolLoopAgent` for reusable agents.** If you plan to use the same agent configuration in multiple routes, extracting to a `ToolLoopAgent` instance avoids duplication.

### Implementation Notes

- `Output.object()` counts as an additional step in the loop. If you have `stepCountIs(5)`, the model gets 4 tool steps + 1 output step.
- Tool `execute` functions run server-side. They can access databases, APIs, file systems.
- Zod v4 (which you have at `^4.3.6`) works with AI SDK 6. The SDK uses `zodSchema()` internally for JSON Schema conversion.
- The `gateway()` function requires a Vercel project with AI Gateway enabled, or appropriate environment variables for direct provider access.

## Sources

1. [AI SDK Core: generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) - Full API reference
2. [AI SDK Core: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) - Tool definition and multi-step patterns
3. [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6) - ToolLoopAgent, Output.object unification
4. [AI SDK Providers: AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway) - Gateway string format
5. [AI SDK Providers: Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) - createAnthropic setup
6. [AI SDK Providers: OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai) - createOpenAI setup
7. [Foundations: Providers and Models](https://ai-sdk.dev/docs/foundations/providers-and-models) - Provider abstraction architecture
8. [AI SDK Core: ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent) - Agent class reference
9. [Agents: Loop Control](https://ai-sdk.dev/docs/agents/loop-control) - stopWhen, prepareStep
10. [AI SDK Core: Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) - Output.object patterns
11. [Foundations: Tools](https://ai-sdk.dev/docs/foundations/tools) - Tool design best practices

## Open Questions

- Whether `ToolLoopAgent` supports `streamText`-style streaming (search results suggest it uses `generateText` internally; for streaming you may still need the direct `streamText` + tools pattern).
- Whether `prepareStep` works with `streamText` or only `generateText` (documentation references both but examples focus on `generateText`).
