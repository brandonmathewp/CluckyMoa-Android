# CluckyMoa — Consolidated Design & UI Developer Plan

> Last updated: 2026-04-07
> Repository: brandonmathewp/CluckyMoa-Android

## Topline Summary

This document consolidates the full design and UI developer plan for CluckyMoa as specified by the product owner. It covers: classes, per-area breed rules, respec/refund+fee system, breeding (full cross-class hybrids), promotion pipeline for exceptional hybrids, and the full UI developer plan wired to the server API. This file is authoritative for engineers, designers, and artists implementing the systems described.

Key signed decisions (by product owner):
- Classes: Air, Ground, Ocean (gameplay-affecting)
- Area coverage: All inhabited Hawaiian islands (Kauaʻi, Oʻahu, Maui, Molokaʻi, Lānaʻi, Hawaiʻi); exclude Niʻihau & Kahoʻolawe
- Each area (neighborhood/district) must have at least 10 unique gameplay-affecting breeds; each breed is obtainable/spawnable only in its native area, but usable/tradable anywhere once owned
- Each breed has one primary active ability and one ultimate (unique globally per chicken)
- Ability governance: Hybrid (primary uses energy pool; ultimate requires energy + long cooldown)
- Abilities upgradable via hybrid model (skill tree + consumable augments); permanent consumable upgrades only obtainable via official limited difficult events
- Respec policy: first respec per chicken is free; subsequent respecs follow Refund + Fee model (full-tree resets only)
- Breeding system: full cross-class hybrids allowed; deterministic server-side RNG, pedigree, incubations, mutation chance, composite traits
- Exceptional hybrids: allow extremely rare player-created hybrids to be promoted to archetype families via a curated telemetry-backed pipeline

---

## 1) Progression & Skill System

### Leveling
- Level cap: 50 (recommended)
- Skill points per level: 1 point/level (so ~50 base points)
- XP curve: faster early, slower late (design to tune)

### Skill point sources
- Leveling (as above)
- Training items (tomes/consumables): grant physical skill points to the chicken
- Milestones and achievements: give one-time points (small)
- Rare lineage bonus on hatch: 0–2 points in special circumstances

### Training items & canonical values
- Canonical training item values (for respec refund accounting):
  - Common Tome (1 SP): 1,000 coins
  - Uncommon Tome (1 SP): 1,800 coins
  - Rare Tome (3 SP): 3,000 coins
  - Epic Tome (5 SP): 8,000 coins
- Weekly cap on training item application per account: 10 skill points/week (prevents farming)
- Training item application increments chicken.training_value_spent by canonical value atomically when consumed

### Skill tree & abilities
- Each chicken has a specialization skill tree
- Primary ability: up to 5 upgrade nodes (damage, cost, cooldown, secondary effects)
- Ultimate: 3-tier upgrade path (unlockable at higher levels; default tiers ~lvl15, lvl30, lvl45)
- Consumable augments: temporary catalysts for ability boosts; permanent consumable upgrades only via official, limited, difficult events

---

## 2) Respec: Refund + Fee (Full Reset Only)

### Policy & intent
- One free full respec per chicken (first respec)
- Subsequent respecs charged: charge fee and refund percentage of training item value previously applied to that chicken
- Respec is full-tree reset only (no partial node unassigns for now)

### Default tuning (recommended, tunable)
- base_fee = 2,000 coins
- refund_pct = 50% (0.5)
- canonical training item values: see section above
- weekly caps already limit training point application

### Flow & rules
- Free respec:
  - Applicable if chicken.freeRespecUsed == false
  - Operation: reset assignedNodes, set unspentSkillPoints = levelPoints (+ milestonePoints), set training_value_spent = 0, mark freeRespecUsed = true, record respec_history entry (free: true)
- Paid respec:
  - refund_amount = floor(training_value_spent * refund_pct)
  - fee = base_fee (optionally escalate per respecPaidCount)
  - Net = refund_amount - fee
    - If Net > 0: credit Net to player's coin balance
    - If Net <= 0: do NOT credit coins; still charge fee (require balance >= fee)
  - Set training_value_spent = 0
  - Increment respecPaidCount
  - Record respec_history with all details

### Payment & failure handling
- Require user.balance >= fee (recommended for simplicity)
- Atomic transaction: deduct fee, credit refund (if any), reset assigned nodes, write history
- Idempotency token required for confirm endpoint to prevent double charges

### Edge options
- Option A (recommended): Paid respec still allowed when training_value_spent == 0 (user pays fee to reorganize allocated level/milestone points)

---

## 3) Chicken Breeds, Abilities & Uniqueness

### Breed rules
- Each breed = gameplay-affecting entity: class (Air/Ground/Ocean), primary ability, ultimate ability, baseStats and uniqueModifierTag
- Signature uniqueness: each chicken has a signature primary + ultimate pair; uniqueModifierTag is the canonical guarantee
- Area exclusivity: breeds are spawnable only in native area
- Once captured/owned, breed is usable/tradable anywhere (subject to temporary trade-locks for rare hatches)

### Archetype & regionalization strategy
- Build 12–16 archetypes across classes (e.g., Ground-Tank, Ground-Striker, Air-Skirmisher, Air-Controller, Ocean-Sniper, Ocean-Controller)
- For each archetype define ability templates and parameter knobs (damage, radius, duration, cooldown, energy cost)
- Regional variants: per area, instantiate archetype with parameter deltas, visual skins, and uniqueModifierTag
- Ensure every breed differs by at least one unique modifier or parameter beyond threshold

### UniqueModifierRegistry
- Central registry of uniqueModifierTag entries and their assignment
- Rules: when authoring a breed, designers pick an unused uniqueModifierTag; system blocks duplicates
- Registry stores provenance (author, area, assignedBreedId)

### Parameter caps and balance guardrails
- Hard caps per class for any critical param (damage, radius, duration)
- Soft targets per archetype
- Ultimate power gating: ult damage ≤ k * primary baseline and requires level gating + long cooldown
- Anti-synergy blacklist for forbidden trait combinations

---

## 4) Area & Acquisition

### Areas
- Islands included: Kauaʻi, Oʻahu, Maui, Molokaʻi, Lānaʻi, Hawaiʻi
- Each area is composed of neighborhoods/districts (e.g., Mililani, Ewa Beach, Downtown, Chinatown, Hilo, etc.)

### Minimum per-area rules
- At least 10 unique breeds per area (unique primary+ultimate signatures enforced)
- Class distribution per area tuned by geography (coastal vs inland). Example baselines:
  - Coastal: 3 Ocean / 4 Ground / 3 Air
  - Urban/inland: 1 Ocean / 6 Ground / 3 Air
  - Mountain/valley: 0–1 Ocean / 6–7 Ground / 3–4 Air

### Spawn & acquisition methods
- World capture (battle / mini-game), area vendor exchange, event hunts, achievement rewards
- Spawn types: common, rare, legendary; event-only spawns with low weights
- Capture methods vary by breed and area

---

## 5) Breeding System (Full Cross‑Class)

### High-level goals
- Allow players to breed owned chickens to produce hybrids, including cross-class composites
- Offspring are unique instances with pedigrees and genomes; server-side RNG resolves outcomes
- Maintain signature uniqueness globally for offspring (resolve collisions at hatch)

### Gene model (modular)
- Genes: classGene (primaryClass + secondaryTraits), statGenes (hp, armor, energyCap, energyRegen, speed), primaryAbilityGene, ultimateAbilityGene, visualGenes, uniqueModifierSeed

### Inheritance algorithm (defaults)
- Parent weighting: 50/50 per gene by default; adjustable via dominance/fertility modifiers
- Numeric genes: child value = weighted average + random variance (±5–12%), clamped to archetype bounds
- Ability genes: copy from parent (preferred), blend across compatible templates (blendChance ~15%), or mutate (mutationChance ~3%)
- uniqueModifierSeed: prefer inheritance; if collision, compose hybrid tag or mutate; server allocates tag atomically at hatch

### Cross-class handling
- If parents differ class: base pick chooses parent primaryClass; compositeChance (default 20%) produces child with primaryClass plus 1–2 secondaryTraits from other parent
- CompositeChance increases with parent rarity (e.g., Rare+Rare yields higher composite chance)
- SecondaryTraits are bounded modifiers (e.g., glideAffinity +10% swimSpeed)

### Egg rarities, costs & incubation
- Egg rarity influenced by parent rarities
- Incubation defaults: Common 12h, Uncommon 24h, Rare 48h, Legendary 96h
- Breed cost defaults: Common 1,000 coins; Uncommon 2,000; Rare 5,000; Legendary 15,000 (tunable)
- Parent cooldown: default 72 hours; lifetime per-parent cap: 8 breedings
- Account caps: e.g., 20 breed attempts/week (tunable)
- Incubator slots limit simultaneous eggs (1 default, more purchasable)

### Care, consumables & accelerants
- Care mini-game during incubation can bias inherit chance or composite chance slightly
- Consumables:
  - Selective Serum: +20% chance to inherit chosen parent gene
  - Fertility Tonic: increases fertilization chance for older parents
  - Accelerants: speed up incubation (paid or consumable)
- Consumables are rate-limited and balanced to avoid pay-to-win

### Uniqueness & collision resolution at hatch
- On hatch, candidate uniqueModifierTag must be allocated atomically
- If collision occurs, attempt strategies up to N attempts (N=3): parameter nudge, alternate composed tag, automated reroll
- If unresolved, mark hatch as rerollable and log for audit; provide player-facing message and a small compensation where appropriate

### Pedigree & lineage
- Store parents, genome snapshot, mutation flags, breederId, and timestamps on each hatched chicken
- Pedigree UI to display family tree; lineage achievements possible

---

## 6) Promotion Pipeline: Hybrids → New Archetypes (Recommended)

### Recommendation summary
- Allow extremely rare hybrids to become new shared archetypes, but only via a tightly-controlled, human-curated pipeline.

### Eligibility & thresholds
- Novel archetype candidate mutation chance very low (~0.05%)
- Candidate must be legendary OR have multiple high-tier modifiers
- Candidate flagged as `archetype_candidate` with dossier stored

### Vetting & data collection
- Collect telemetry: pick/use rates, match usage, trade volume, win-rate metrics, anomaly metrics
- Candidate stays instance-level while dossier collects data (min 7 days)

### Designer review & promotion
- Designers run balance sims, check art feasibility, and sign off
- If approved, promote candidate to archetype catalog with tuned parameters and canonical assets
- Recognize original breeders (badges/acknowledgment)

### Governance & rollback
- Human sign-off required; admin actions logged
- If promoted archetype proves broken, have staged rollback/deprecation plan with compensation

---

## 7) Data Model & DB Schema (high level)

Collections / Tables (NoSQL style suggested):

- chickens/{chickenId}
  - ownerId: string
  - breedId: string (can be null for hybrids that are instance-only)
  - primaryClass: string (Air|Ground|Ocean)
  - secondaryTraits: [string]
  - level: int
  - unspentSkillPoints: int
  - assignedNodes: map/list
  - training_value_spent: int
  - freeRespecUsed: bool
  - respecPaidCount: int
  - parents: {parentAId, parentBId}
  - genomeSnapshot: json
  - mutationFlags: [string]
  - breedCount: int
  - lastBreedAt: timestamp
  - visualRefs: {modelId, skinId, vfxPaletteId}

- eggs/{eggId}
  - ownerId, parentAId, parentBId, createdAt
  - rarity: string
  - incubationEndsAt: timestamp
  - genomeSeedBlob: json
  - careModifiers: map
  - status: enum (incubating, hatched, cancelled)

- unique_modifier_registry/{tag}
  - assigned: bool
  - assignedBreedId: string
  - allowedClasses: [string]
  - metadata: {provenance}

- respec_history/{id}
  - chickenId, actorUserId, createdAt, free:bool
  - feeCharged:int, refundGiven:int, training_value_spent_before:int, notes

- breeding_history/{id}
  - actorId, parentAId, parentBId, eggId, costPaid, consumablesUsed
  - resultChickenId, mutationHappened, createdAt

- archetype_candidates/{id}
  - genomeSnapshot, telemetrySummary, ownerId, createdAt, reviewedFlag

---

## 8) API Contracts (sample shapes)

Breeding Preview (no writes):
- POST /api/breeding/preview
  - body: { parentAId, parentBId, consumables: [{id, qty}] }
  - response:
    {
      classProbabilities: {Air:0.45, Ground:0.5, Ocean:0.05},
      compositeChance: 0.20,
      mutationChance: 0.03,
      abilityOrigin: { primary: {A:0.7, B:0.25, blend:0.05}, ultimate: {...} },
      eggRarity: {common:0.6, uncommon:0.3, rare:0.09, legendary:0.01},
      cost: {coins:1000, consumablesCost:200, total:1200},
      incubationSeconds:43200,
      previewSeedHash: "sha256(...)"
    }

Breeding Confirm (transactional):
- POST /api/breeding/confirm
  - headers: { X-Idempotency-Token }
  - body: { parentAId, parentBId, consumables: [...], paymentMethodId }
  - response: { eggId, incubationEndsAt, message }

Respec Preview:
- GET /api/chickens/{id}/respec/preview
  - response: { free: bool, training_value_spent: int, refundAmount: int, fee: int, net: int, balanceRequired: int }

Respec Confirm (transactional):
- POST /api/chickens/{id}/respec
  - headers: { X-Idempotency-Token }
  - body: { confirm: true }
  - response: { result: "success", feeCharged: int, refundGiven: int, newBalance: int, respecHistoryId: string }

Egg / Hatch endpoints:
- GET /api/eggs/{eggId}
- POST /api/eggs/{eggId}/accelerate
- POST /api/eggs/{eggId}/careAction

Admin endpoints (internal):
- GET /admin/archetypeCandidates
- POST /admin/promoteCandidate {candidateId, tunedParams}
- GET /admin/uniqueModifiers

---

## 9) UI Developer Plan (integrated with the gameplay design)

Goal: Implement a clear, safe, and accessible UI for browsing breeds, managing owned chickens, performing respecs, breeding, incubation, hatch reveals, pedigree, and admin promotion tools. All RNG and final allocations are server-driven; client shows previews only.

### Platform & architecture assumptions
- Cross-platform UI component library shared across mobile/desktop
- REST + WebSocket for async events
- Client must never assume allocation outcomes; previews are informative only
- Use idempotency tokens for transactional endpoints

### Primary screens & components (summarized)
- Chicken Catalogue (area filter, breed cards)
- Breed Detail (full ability text, "why unique", spawn info)
- Owned Chicken Inventory (per-chicken quick actions)
- Skill Tree (node previews, respec preview & confirm)
- Breeding flow (parent select → preview → confirm)
- Egg Inventory / Incubator (timers, care mini-game, accelerants)
- Hatch Reveal & Pedigree UI
- Admin / Designer Tools (candidate dossier, promote archetype)

Each screen described in detail in the full spec; frontend devs must implement components with accessibility and localization in mind.

### Reusable components & tokens
- BreedCard, StatBar, AbilityRow, ProbabilityBar, ConfirmModal, TimerBadge, PedigreeTree, EggCard
- Design tokens: per-class color palettes, rarity tokens, typography and spacing

### UX safety & copy
- Explicit confirmations for payment (respec fee & breeding costs)
- Preview breakdowns for respec refunds and breed probabilities
- Hatch collision messages handled gracefully (automated re-roll or informative note)

### Analytics & telemetry hooks (frontend events)
- breed_preview_shown, breed_confirmed, egg_hatched, respec_preview_shown, respec_confirmed, archetypeCandidate_seen, archetype_promoted

---

## 10) Anti‑Abuse, Security & Fairness

- All random choices done server-side and deterministic seeds persisted on egg objects
- Transactional DB operations for payments, respecs, egg creation and uniqueModifier allocation
- Idempotency tokens for critical endpoints
- Weekly caps: training application cap (10 SP/week), breeding attempt cap (20/week default), incubator slot limits, lifetime per-parent breed cap (8)
- Parental cooldowns (72 hours default)
- Trade locks on rare/legendary hatches (24–72h)
- Telemetry + anomaly detection for mass breeding and market manipulation

---

## 11) Testing Checklist

Unit tests:
- Respec path: free, paid (refund > fee, refund == fee, refund < fee), insufficient funds
- Breeding deterministic seeding tests
- Uniqueness registry allocation race tests

Integration tests:
- Egg lifecycle end-to-end: preview → confirm → incubate → hatch
- Parental cooldown & cap enforcement
- Admin promotion flow (staging)

Playtests & QA:
- Balance passes for archetypes and representative hybrids
- Animation & locomotion tests for cross-class visuals
- Accessibility tests: keyboard & screen reader flows

---

## 12) Metrics & Monitoring

Key metrics to collect:
- breed_attempts_per_week, composite_rate, mutation_rate_observed, egg_rarity_distribution
- pick/usage/win rates per breed and archetype
- respec_count_by_breed, refunds_vs_fees
- archetype_candidate_dossiers: pick/use counts and outcomes
- economic metrics: accelerant purchases, incubator slot purchases, breeding-related currency flows

Alerts:
- refunds consistently exceeding fees
- spikes in breeding volume or uniqueModifier collisions
- unusually high pick/win rates for newly promoted archetype

---

## 13) Implementation Roadmap (recommended)

Phase 1 — Core systems
- UniqueModifierRegistry, respec API + DB fields, archetype templates + authoring importer

Phase 2 — Breeding MVP
- breeding preview + confirm, egg creation, incubation job, hatch job, incubator UI and slots

Phase 3 — Cross-class, composite & mutations
- blending algorithms, composite traits, visual blending, mutation pool, care mini-game

Phase 4 — Promotion & live operations
- candidate dossier store, admin promotion UI, telemetry dashboards, staged release for promoted archetypes

---

## 14) Next Steps & Deliverables

- Hand off this file to engineering, design, and art teams.
- Prioritize Phase 1 with a pilot area and small breed set to validate pipelines.
- Implement telemetry early to collect signals for breeding balance and archetype promotions.

---

## Appendix: Examples & Scenarios

1) Respec example
- Chicken training_value_spent = 10,000
- refund = 10,000 * 0.5 = 5,000
- fee = 2,000
- net = 3,000 → player receives +3,000

2) Breeding example
- Parent A: Air "Neon Kite" (rare), Parent B: Ocean "Reefwarden" (rare)
- Preview: 50% Air / 30% Ocean / 20% composite; composite chance increased due to rarity
- Egg: Rare, incubation 48h
- Hatch produce: Air primary with swimAffinity secondary or Ocean primary with glideAffinity secondary or rare mutation

3) Promotion example
- Extremely rare hybrid hatches flagged as archetype_candidate (mutation pool hit)
- Candidate dossier auto-collected; designers review and may promote to official archetype after telemetry & QA

---

## Contact & Ownership
- Product Owner: brandonmathewp (repo owner)
- Suggested leads: Systems Designer (for balance), Server Engineer (for registry & transactional guarantees), Frontend Lead (UI implementation), Art Lead (templates & visual blending)

---

*(End of file)*