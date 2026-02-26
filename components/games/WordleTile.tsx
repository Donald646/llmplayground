import type { TileFeedback } from "@/lib/games/wordle-types";

export function WordleTile({
  letter,
  feedback,
}: {
  letter?: string;
  feedback?: TileFeedback;
}) {
  const bg =
    feedback === "correct"
      ? "bg-green-500 text-white border-green-500"
      : feedback === "present"
        ? "bg-yellow-500 text-white border-yellow-500"
        : feedback === "absent"
          ? "bg-neutral-700 text-white border-neutral-700"
          : "border-border/50 bg-muted/20";

  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-base font-bold uppercase transition-colors duration-300 ${bg}`}
    >
      {letter ?? ""}
    </div>
  );
}
