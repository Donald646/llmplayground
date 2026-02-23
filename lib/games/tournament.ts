import type { MatchResult, Model, MatchPairing, Standing } from "./types";

export function generatePairings(allModels: Model[]): MatchPairing[] {
  const pairings: MatchPairing[] = [];
  for (let i = 0; i < allModels.length; i++) {
    for (let j = i + 1; j < allModels.length; j++) {
      pairings.push({ modelA: allModels[i], modelB: allModels[j] });
    }
  }
  return pairings;
}

export function calculateStandings(
  allModels: Model[],
  matches: MatchResult[]
): Standing[] {
  const map = new Map<string, Standing>();

  for (const model of allModels) {
    map.set(model.id, {
      model,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      totalScore: 0,
      matchesPlayed: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== "complete" || !match.response) continue;
    const { judgment } = match.response;
    const a = map.get(match.pairing.modelA.id)!;
    const b = map.get(match.pairing.modelB.id)!;

    a.matchesPlayed++;
    b.matchesPlayed++;
    a.totalScore += judgment.scoreA;
    b.totalScore += judgment.scoreB;

    if (judgment.winner === "modelA") {
      a.wins++;
      a.points += 3;
      b.losses++;
    } else if (judgment.winner === "modelB") {
      b.wins++;
      b.points += 3;
      a.losses++;
    } else {
      a.draws++;
      a.points += 1;
      b.draws++;
      b.points += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.points - a.points || b.totalScore - a.totalScore
  );
}
