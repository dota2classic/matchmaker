# Live mirror rollout update

Live mirror-500 and observational shadow are now enabled by default. Set MATCHMAKING_MIRROR_LIVE_ENABLED=false to restore the original team assignment while preserving FIFO selection and recording. Set MATCHMAKING_MIRROR_SHADOW_ENABLED=false to stop recording. Explicit false is the kill switch; an absent variable enables the feature.

The main algorithm selects ten players, then selectLive applies the valid mirror-500 assignment. Missing/invalid profiles or exceptions fall back to the original assignment. Logging retains both original inputs and appliedAssignment; mirror-1000 remains observational only. No additional waiting or skill-limit relaxation is introduced by this assignment step. The initial deployment needs the additive migration below. The following original design notes are superseded wherever they describe observational-only or default-off behavior.

# Mirror shadow comparison for ordinary 5v5

The shadow component preserves the live score formula and does not replace team assignments. It captures lifetime PvP experience independently and compares alternative assignments of the **same ten selected players** after the live room has been created and published. It does not implement alternative pool selection, hidden performance ratings or role matching. The accompanying live oldest-first selection fix is described separately in [queue-fairness.md](queue-fairness.md).

## Enabling

The flag defaults to off. Set `MATCHMAKING_MIRROR_SHADOW_ENABLED=true` to collect comparisons. Any other value, including an absent flag, disables scheduling. Only `MatchmakingMode.UNRANKED` is eligible; other modes are unchanged.

Migration `1793538000000-MirrorShadow` adds nullable `pvp_games`, `season_mmr`, `balance_stats_at` columns to `player_in_party` and creates `mirror_shadow_evaluation`. The existing application runs compiled migrations at startup. No production migration or rollout was performed while authoring this change. Apply the migration before running the new entities; a startup of this revision will apply it even with shadow disabled, because that is the existing application migration policy.

Old queued records remain unknown (`NULL`). They are not backfilled as zero. The next normal queue preparation captures `summary.overall.games`, `summary.season.mmr` and capture time. Seasonal games continue to be used by the existing strength formula, exactly as before. Experience is validated as a nonnegative PostgreSQL integer; invalid/missing counts become unknown. `overall.games` is the gameserver's lifetime leaderboard summary for ranked/unranked PvP, not total games in every mode or a direct live history count. Its refresh lag can affect the snapshot; monitor skipped results and data freshness before trusting comparisons near the threshold.

## Comparison policy v1

Snapshots retain party IDs, player IDs, exact individual/party scores, lifetime games, MMR, profile time, original assignments, queue entry times, avoid lists and the settings used for the cycle. These are internal operational records; public API responses are unchanged. `capturedAt` is the time the selected-ten snapshot was made after room creation, not a reconstructed queue exit time. The full pool and unselected players are not captured in this version.

Unknown experience or MMR causes an `insufficient_data` result, not a novice classification. Duplicate participants, inconsistent party totals, invalid 5v5 assignments or violated hard limits cause `invalid_input`. Both statuses are retained for diagnosing coverage.

For a complete valid snapshot:

1. Enumerate party-preserving 5v5 assignments, fixing the first party to remove equivalent side swaps. Ten solos have 126 unique assignments.
2. Reject same-team avoid conflicts. The selected ten and their individual score spread are unchanged. Validate the configured player-spread and baseline team-difference limits.
3. For each budget B=500/1000 allow `scoreGap <= min(hardTeamLimit, max(baselineGap, B))`. The budget is a difference of **total internal scores**, not an MMR ceiling, an average or an amount added to baselineGap. If baselineGap=800, budget 500 permits 800 and budget 1000 permits 1000.
4. Lexicographically minimize: novice count difference (`pvpGames < 10`), low-MMR count difference (`mmr <= 500`), floor count difference (`mmr <= 10`), average distance between sorted team MMRs, total score difference. Keep the live assignment on an exact objective tie.
5. Persist original/alternative party assignments, all objective components, per-player sorted-rank MMR distances, counts of improved/worsened players and maximum individual worsening. `changed` ignores a pure side swap. The profile thresholds are experimental and fixed by `mirror-shadow-v1`; changing them requires a new version for comparable records.

Sorted-rank MMR distance is a composition diagnostic, not a role/lane matchup or a calibrated probability of winning. No claims about counterfactual wins, increased winrate, improved individual experience, or queue waiting time can be inferred just from these records. An `insufficient_data` player is not assumed to have low skill or zero games.

## Failure and resource boundaries

Snapshotting makes copies; alternatives never flow back into `GameBalance`, room creation or queue membership. The service returns immediately; deferred computations and writes run after scheduling. Failures are logged and contained. Up to eight outstanding jobs per process are accepted; excess jobs are skipped with a warning. Database writes are serialized so shadow uses at most one concurrent write per process. Calculation is bounded to selected-ten partitions and runs on the same Node event loop; deferment does not mean zero CPU cost. Monitor stored `result.computeMillis` and skipped backlog logs.

This is best-effort collection: shutdown or database failure can lose pending observations. The unique room index prevents duplicate rows. There is no foreign key to `room`, since ready-check rooms are later deleted. A row describes a **found room**, including declined or timed-out rooms; it does not alone prove that the match was played. Join through the retained `match_entity.matchInfoJson.roomId` and `finished_match` when studying completed matches. Retention/archival is an operational choice; no automatic deletion is introduced.

## Reviewing collected data

Use [mirror-shadow-report.sql](mirror-shadow-report.sql) for coverage, variant summaries and equally weighted account changes. Start with an explicit date window and distinguish all found rooms from completed matches. Examine novice/low-MMR gaps, score gaps, party structure and individual worsening across MMR bands. Do not select a winner by one average or by replaying the same development sample. Before live adoption, verify new data, CPU cost and queue-pool behavior; the selected-ten comparison does not measure extra waiting or unformed games.

## Local verification

Initialize the pinned `src/gateway` submodule before building. The repository uses Yarn; npm may require legacy peer resolution for its existing Swagger dependency mismatch. No package manifest or lock update is part of this change.

Build the project, then run these focused suites:

```text
npm test -- --runInBand --runTestsByPath src/matchmaker/balance/mirror-shadow.spec.ts src/matchmaker/service/mirror-shadow.service.spec.ts src/matchmaker/service/player-experience.spec.ts src/matchmaker/service/queue-shadow.spec.ts
npm test -- --runInBand --runTestsByPath src/matchmaker/service/mirror-shadow.integration.spec.ts
```

The PostgreSQL integration suite requires a working Docker daemon and tests applying the migration chain, persistence, uniqueness, rollback and reapplication against a disposable database. Existing container-backed queue tests should also run before rollout. None of these tests should target production.

To replay a stored row, pass its `input` JSON to the pure `compareMirror` function in `src/matchmaker/balance/mirror-shadow.ts`; the comparison has no dependency on current time, a network request or live mutable parties. Computation timing is recorded by the service, not by the pure function.

## Verification performed

Production build and focused ESLint checks passed on the dependency versions in the existing `yarn.lock`. The nine selected suites cover 93 distinct tests: new shadow/experience unit tests, the PostgreSQL migration/reporting integration tests, and existing balancing, worker, queue service and database queue tests. All passed after the focused integration rerun. Manifest and lock files are unchanged.

The compiled comparison was also checked against the research results for 22 anonymized historical all-solo matches with no avoid lists (44 alternative variants). Objective components matched within floating-point tolerance and inputs were not mutated. This validates numerical parity for that subset, not complete live replay or counterfactual outcomes. Local computation time on those fixtures had a median of about 1.5 ms and maximum about 4.7 ms; this is not a production latency guarantee.

The feature remains off by default. No production deployment, flag change or production schema migration was performed as part of this implementation.
