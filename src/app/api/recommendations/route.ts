import { catalog } from "@/lib/catalog";
import { emptyScores } from "@/lib/emotion/taxonomy";
import { recommend } from "@/lib/recommendations/engine";
import { errorResponse, INVALID_JSON, json, readJson, validationError } from "@/lib/server/http";
import { RecommendRequestSchema } from "@/lib/validation/schemas";

const collectionTitles = new Map(catalog.collections.map((c) => [c.id, c.title]));

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body === INVALID_JSON) return errorResponse(400, "invalid_json", "Request body must be JSON.");
  const parsed = RecommendRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { profile, ...opts } = parsed.data;
  const recs = recommend(
    { ...profile, scores: { ...emptyScores(), ...profile.scores } },
    catalog.tracks,
    opts,
    collectionTitles,
  );

  const slim = (group: typeof recs.meet) =>
    group.map(({ track, score, reason }) => ({ trackId: track.id, score, reason, track }));

  return json({
    meet: slim(recs.meet),
    shift: slim(recs.shift),
    explore: slim(recs.explore),
    shiftDirection: recs.shiftDirection,
    target: recs.target,
    shiftTarget: recs.shiftTarget,
    preferenceRelaxed: recs.preferenceRelaxed,
  });
}
