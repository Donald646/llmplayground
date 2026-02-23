# LLM Playground

A Next.js application for experimenting with large language models through interactive games, AI chat, and prediction market trading.

## Features

### AI Chat
Multi-model chat interface with streaming responses and specialized agents.

- **Model selection:** Gemini 2.5 Flash/Pro, Claude Sonnet 4.5, GPT-4o, Grok 4.1 Fast
- **Agents:**
  - **Web Search** — Quick factual lookups and current events via Tavily
  - **Deep Research** — Multi-step research with cross-referenced sources
  - **Code** — Programming tasks, debugging, and architecture questions
  - **Creative** — Writing, storytelling, and brainstorming
- File attachments with drag-and-drop
- Inline citations from web search results

### Games

#### LLM Arena — Round Robin Tournament (`/games`)
Four models compete head-to-head across three game types:
- **Trivia Battle** — Knowledge questions scored on accuracy
- **Debate Arena** — Models argue opposing sides, judged by a third model
- **Word Games** — Creative challenges (rhymes, associations, acronyms)

Live match streaming, real-time leaderboard, and W/D/L tracking.

#### Wordle Duel (`/games/wordle`)
Two models race to guess a secret 5-letter word with standard Wordle feedback (correct/present/absent). Features trash talk between models during gameplay.

#### Shared Board Wordle (`/games/wordle-shared`)
A variant where two models share one board and take turns. The loser gets eliminated.

#### 3D Battle Arena (`/games/arena`)
Turn-based combat in a Three.js powered 3D arena:
- Simultaneous action resolution (move, attack, defend, special, dash, heal, charge)
- Dynamic terrain with walls and lava tiles
- Power-ups (heal, damage boost, shield)
- Critical hits, knockback, counter-damage, and cooldown systems
- Real-time battle log with round narration

### Polymarket Trading (`/markets`)
Paper trading interface for prediction markets:
- Market scanning with volume and liquidity data
- AI-powered analysis (fair value prediction, edge calculation, confidence scoring)
- Portfolio tracking with open positions and unrealized P&L
- Trade history

### Standalone Polymarket Bot (`/polymarket-bot`)
An autonomous CLI bot for prediction market trading:
```
scan              List tradeable markets
analyze <slug>    AI analysis of a specific event
run               Start continuous trading loop
portfolio         Show positions and P&L
```

## Tech Stack

| Category | Libraries |
|---|---|
| Framework | Next.js 16, React 19 |
| AI/LLM | AI SDK (Gateway, Google, React), Tavily |
| 3D | Three.js, React Three Fiber, Drei |
| UI | Radix UI, shadcn/ui, Tailwind CSS |
| Animation | Motion (Framer Motion) |
| Code | Shiki (syntax highlighting), Streamdown |
| Validation | Zod |

## Getting Started

### Prerequisites
- Node.js 20+
- [Bun](https://bun.sh) (recommended) or npm

### Install & Run

```bash
# Install dependencies
bun install

# Start dev server
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Create a `.env.local` file with your API keys:

```env
# AI providers (add the ones you need)
GOOGLE_GENERATIVE_AI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Web search
TAVILY_API_KEY=
```

## Project Structure

```
app/
  page.tsx              # AI chat interface
  api/
    chat/               # Chat streaming endpoint
    games/              # Game turn resolution APIs
    markets/            # Market scan, analyze, trade, portfolio APIs
  games/
    page.tsx            # Tournament hub
    arena/              # 3D battle arena
    wordle/             # Wordle duel
    wordle-shared/      # Shared board wordle
  markets/              # Polymarket trading UI
components/
  ai-elements/          # 48 AI-aware display components
  arena/                # 3D arena (Scene, Fighter, Effects)
  ui/                   # 25+ shadcn UI components
lib/
  games/                # Game logic, prompts, tournament systems
  polymarket/           # Market API, analysis, risk, portfolio
polymarket-bot/         # Standalone CLI trading bot
```
