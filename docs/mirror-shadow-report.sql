-- Read-only examples. Choose a fixed time range before collecting conclusions.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

-- Coverage: skipped inputs must not disappear from the denominator.
SELECT input->>'version' AS version, result->>'status' AS status, count(*) AS rooms
FROM mirror_shadow_evaluation
WHERE created_at >= now() - interval '7 days'
GROUP BY 1, 2 ORDER BY 1, 2;

-- Candidate comparison for found rooms, not counterfactual match outcomes.
SELECT v->>'budget' AS budget, count(*) AS rooms,
       count(*) FILTER (WHERE (v->>'changed')::boolean) AS changed_rooms,
       avg((e.result->'baseline'->'metrics'->>'newPlayerGap')::numeric) AS baseline_new_gap,
       avg((v->'metrics'->>'newPlayerGap')::numeric) AS mirror_new_gap,
       avg((e.result->'baseline'->'metrics'->>'scoreGap')::numeric) AS baseline_score_gap,
       avg((v->'metrics'->>'scoreGap')::numeric) AS mirror_score_gap,
       avg((v->>'worsenedPlayers')::numeric) AS worsened_players_per_room,
       max((v->>'maxIndividualWorsening')::numeric) AS worst_rank_distance_increase,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY (e.result->>'computeMillis')::double precision) AS compute_ms_p95
FROM mirror_shadow_evaluation e
CROSS JOIN LATERAL jsonb_array_elements(e.result->'variants') v
WHERE e.created_at >= now() - interval '7 days' AND e.result->>'status' = 'compared'
GROUP BY 1 ORDER BY 1;

-- Equally weighted account changes; repeated appearances first average within account.
WITH appearances AS (
  SELECT v->>'budget' AS budget, d.key AS player_id,
         (v->'metrics'->'rankDistanceByPlayer'->>d.key)::numeric - d.value::numeric AS delta
  FROM mirror_shadow_evaluation e
  CROSS JOIN LATERAL jsonb_array_elements(e.result->'variants') v
  CROSS JOIN LATERAL jsonb_each_text(e.result->'baseline'->'metrics'->'rankDistanceByPlayer') d
  WHERE e.created_at >= now() - interval '7 days' AND e.result->>'status' = 'compared'
), accounts AS (
  SELECT budget, player_id, avg(delta) AS mean_delta FROM appearances GROUP BY 1, 2
)
SELECT budget, count(*) AS accounts,
       count(*) FILTER (WHERE mean_delta < 0) AS improved,
       count(*) FILTER (WHERE mean_delta > 0) AS worsened,
       count(*) FILTER (WHERE mean_delta = 0) AS unchanged,
       avg(mean_delta) AS equally_weighted_mean_delta, max(mean_delta) AS worst_account_mean_delta
FROM accounts GROUP BY 1 ORDER BY 1;

-- Per-appearance changes by the participant's own MMR band.
-- Rank distances describe sorted compositions, not real lane opponents.
WITH appearances AS (
  SELECT v->>'budget' AS budget, p->>'id' AS player_id,
         CASE WHEN (p->>'mmr')::numeric <= 500 THEN '1: <=500'
              WHEN (p->>'mmr')::numeric < 1500 THEN '2: 501-1499'
              WHEN (p->>'mmr')::numeric < 2500 THEN '3: 1500-2499'
              WHEN (p->>'mmr')::numeric < 3000 THEN '4: 2500-2999'
              ELSE '5: >=3000' END AS mmr_band,
         (v->'metrics'->'rankDistanceByPlayer'->>(p->>'id'))::numeric -
         (e.result->'baseline'->'metrics'->'rankDistanceByPlayer'->>(p->>'id'))::numeric AS delta
  FROM mirror_shadow_evaluation e
  CROSS JOIN LATERAL jsonb_array_elements(e.result->'variants') v
  CROSS JOIN LATERAL jsonb_array_elements(e.input->'parties') party
  CROSS JOIN LATERAL jsonb_array_elements(party->'players') p
  WHERE e.created_at >= now() - interval '7 days' AND e.result->>'status' = 'compared'
)
SELECT budget, mmr_band, count(*) AS appearances, count(DISTINCT player_id) AS accounts,
       avg(delta) AS mean_distance_change,
       count(*) FILTER (WHERE delta > 0) AS worsened_appearances,
       max(delta) AS worst_increase
FROM appearances GROUP BY 1, 2 ORDER BY 1, 2;

COMMIT;
