# Oldest feasible groups first for 5v5

Previously age was only a term in the balance objective: a newer set could beat an older feasible set on score. Additionally the 20-minute predicate required up to eight old parties simultaneously; one incompatible party could prevent otherwise valid matches.

Ordinary 5v5 and Highroom now compare valid candidates lexicographically by membership in the oldest-first party list. At the first party where two candidate sets differ, the set including the older party wins. For the same selected parties, the existing balance function still chooses the team split. Groups remain atomic and existing team/player score limits and avoid lists remain hard constraints. Newer players may still play first when an older group cannot fit into a valid match; it stays queued with its original age. No age-based relaxation of skill limits is introduced.

The unconditional 20-minute inclusion predicate is removed for 5v5 only. Other team sizes and fast-mode algorithms retain their behavior. Priority is passed explicitly through the worker; callers that omit it retain score-first selection. QueueService supplies the pool ordered by enterQueueAt, including preserved timestamps after failed ready checks.

This prioritizes fairness over finding the smallest possible score gap across different player sets. It does not guarantee a maximum waiting time, prove every skipped group was infeasible, or overcome the existing bounded-search timeout. It chooses the oldest feasible set among candidates actually explored. Selection can still miss feasible sets if the search exhausts its time budget.

Regression cases cover an older player with a slightly worse but legal score gap, an incompatible oldest player, worker propagation, and an over-20-minute incompatible group not blocking the other ten. See mirror-shadow.md for the independent disabled-by-default observational comparison.
