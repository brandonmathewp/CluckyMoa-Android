# CluckyMoa — Complete Implementation Blueprint

> Version: 2.0
> Last updated: 2026-04-07
> Repository: brandonmathewp/CluckyMoa-Android
> Status: **AUTHORITATIVE SOURCE OF TRUTH — implementation-ready**

This document is the single authoritative blueprint for building CluckyMoa end-to-end. It contains everything an autonomous coding agent or engineering team needs to implement every system, screen, API endpoint, and operational procedure. Do not maintain parallel specs; update this file as decisions evolve.

---

## Table of Contents

1. [Product Requirements & Success Criteria](#1-product-requirements--success-criteria)
2. [Functional Requirements by Feature](#2-functional-requirements-by-feature)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [System Architecture](#4-system-architecture)
5. [Data Model — Firestore Schemas](#5-data-model--firestore-schemas)
6. [API Contract](#6-api-contract)
7. [Frontend Architecture & Screen Specs](#7-frontend-architecture--screen-specs)
8. [Backend Architecture & Service Boundaries](#8-backend-architecture--service-boundaries)
9. [Algorithms — Deterministic Pseudocode](#9-algorithms--deterministic-pseudocode)
10. [Security, Anti-Abuse & Fraud Controls](#10-security-anti-abuse--fraud-controls)
11. [Telemetry, Analytics & Dashboards](#11-telemetry-analytics--dashboards)
12. [Testing Strategy](#12-testing-strategy)
13. [Rollout Plan & Feature Flags](#13-rollout-plan--feature-flags)
14. [CI/CD & Branching/Release Workflow](#14-cicd--branchingrelease-workflow)
15. [Operational Runbooks & Incident Handling](#15-operational-runbooks--incident-handling)
16. [Implementation Phases with Acceptance Criteria & DoD](#16-implementation-phases-with-acceptance-criteria--dod)
17. [Risks, Mitigations & Open Decision Defaults](#17-risks-mitigations--open-decision-defaults)
18. [Agent Execution Instructions](#18-agent-execution-instructions)
19. [Signed Decisions Reference](#19-signed-decisions-reference)

---

## 1. Product Requirements & Success Criteria

### 1.1 Product Vision

CluckyMoa is a location-based mobile game for Android set across the inhabited Hawaiian Islands. Players explore real-world neighborhoods to discover, capture, breed, and battle unique chickens. Each chicken is a globally unique digital entity with a signature ability pair and visual identity. The game blends collection, strategy, economy, and social gameplay.

### 1.2 Target Platform

- Android (minimum SDK 26 / Android 8.0)
- Kotlin with Jetpack Compose UI
- Firebase backend (Firestore, Cloud Functions, Firebase Auth, Firebase Storage)
- Google Maps SDK for location layer

### 1.3 Success Criteria — Launch (v1.0)

| Metric | Target |
|--------|--------|
| Day-1 retention | ≥ 40% |
| Day-7 retention | ≥ 20% |
| Breed attempts per active user/week | ≥ 3 |
| Respec usage among level 10+ players | ≥ 10% |
| Uniqueness collision rate at hatch | < 0.5% |
| Hatch job P99 latency | < 3 s |
| Crash-free sessions | ≥ 99.5% |
| API error rate (5xx) | < 0.1% |
| Unique breeds per area at launch | ≥ 10 |

### 1.4 Out-of-Scope for v1.0

- PvP real-time battles (async turn-based only)
- Auction house (direct trade only)
- iOS client
- Niʻihau and Kahoʻolawe islands

---

## 2. Functional Requirements by Feature

### 2.1 Authentication & Account

- FR-AUTH-01: Players authenticate via Google Sign-In (Firebase Auth).
- FR-AUTH-02: Each account has a unique `userId`, display name, and coin balance.
- FR-AUTH-03: Session tokens refresh silently; expired sessions redirect to login.
- FR-AUTH-04: Accounts can be soft-deleted (anonymized) on player request; chickens and eggs move to escrow state.

### 2.2 Location & Area System

- FR-LOC-01: App requests foreground location permission; background location is not required.
- FR-LOC-02: The world is divided into areas corresponding to Hawaiian neighborhoods/districts.
- FR-LOC-03: Islands included: Kauaʻi, Oʻahu, Maui, Molokaʻi, Lānaʻi, Hawaiʻi island. Niʻihau and Kahoʻolawe are excluded.
- FR-LOC-04: Each area has a spawn configuration defining breed weights and spawn rate.
- FR-LOC-05: Players can only encounter wild breeds native to the area they are physically in.
- FR-LOC-06: Once captured, a chicken is usable and tradable anywhere.
- FR-LOC-07: Each area contains at least 10 distinct breeds with unique primary+ultimate signatures.
- FR-LOC-08: Area classification drives class distribution:
  - Coastal: 3 Ocean / 4 Ground / 3 Air
  - Urban/inland: 1 Ocean / 6 Ground / 3 Air
  - Mountain/valley: 0–1 Ocean / 6–7 Ground / 3–4 Air

### 2.3 Chicken Breeds & Archetypes

- FR-BREED-01: Every chicken belongs to one primary class: Air, Ground, or Ocean.
- FR-BREED-02: Each chicken has exactly one primary ability and one ultimate ability.
- FR-BREED-03: Each chicken has a globally unique `uniqueModifierTag` that distinguishes its ability signature.
- FR-BREED-04: Archetypes are designer-authored templates (12–16 at launch). Regional variants instantiate an archetype with parameter deltas and visual skins.
- FR-BREED-05: Hybrid chickens (cross-class offspring) are instance-only unless promoted through the archetype pipeline.
- FR-BREED-06: Breeds spawnable only in their native area; no wild spawns outside native area.

### 2.4 Progression & Skill System

- FR-PROG-01: Level cap is 50.
- FR-PROG-02: Each level grants 1 skill point (50 base skill points max).
- FR-PROG-03: Additional skill points from training items (tomes), milestones, and rare lineage bonuses (0–2 on hatch).
- FR-PROG-04: Skill tree contains nodes for the primary ability (up to 5 upgrade nodes) and ultimate ability (3-tier path).
- FR-PROG-05: Primary ability nodes: damage, energy cost, cooldown, secondary effects, range.
- FR-PROG-06: Ultimate tiers unlock at approximately level 15, 30, 45 (exact thresholds tunable via Remote Config).
- FR-PROG-07: Consumable augments provide temporary or permanent ability modifications. Permanent upgrades only via official limited/difficult events.
- FR-PROG-08: Weekly cap on training item application: 10 skill points per account per week.
- FR-PROG-09: Training item canonical values:
  - Common Tome (1 SP): 1,000 coins
  - Uncommon Tome (1 SP): 1,800 coins
  - Rare Tome (3 SP): 3,000 coins
  - Epic Tome (5 SP): 8,000 coins

### 2.5 Ability Governance

- FR-ABIL-01: Primary ability uses an energy pool (recharges over time or via actions).
- FR-ABIL-02: Ultimate ability requires energy threshold AND a long cooldown (separate from primary).
- FR-ABIL-03: Energy cap, regen rate, and cooldown durations are stat-gene-derived values, clamped to archetype bounds.
- FR-ABIL-04: No secondary ability slot; secondary class traits are passive stat modifiers only.
- FR-ABIL-05: Anti-synergy blacklist blocks forbidden trait+ability combinations.

### 2.6 Respec System

- FR-RESPEC-01: First respec per chicken is free.
- FR-RESPEC-02: Subsequent respecs: charge a fee and refund a percentage of training item value spent on that chicken.
- FR-RESPEC-03: Respec resets the full skill tree (no partial node unassign).
- FR-RESPEC-04: Default tuning:
  - `base_fee` = 2,000 coins
  - `refund_pct` = 0.50 (50%)
  - Fee escalation per additional paid respec: +500 coins per `respecPaidCount` (tunable via Remote Config)
- FR-RESPEC-05: `refund_amount = floor(trainingValueSpent × refund_pct)`
- FR-RESPEC-06: Net = refund_amount − fee.
  - If Net > 0: credit Net to player balance.
  - If Net ≤ 0: do NOT credit coins; still charge full fee.
- FR-RESPEC-07: Require player balance ≥ fee before proceeding.
- FR-RESPEC-08: All respec operations are atomic and idempotency-token protected.
- FR-RESPEC-09: Paid respec allowed even when trainingValueSpent == 0 (player reorganizes level/milestone points; still pays fee).

### 2.7 Breeding System

- FR-BREEDNG-01: Players can breed two owned chickens to produce an egg.
- FR-BREEDNG-02: Full cross-class breeding is allowed; offspring can be same class as either parent or a composite hybrid.
- FR-BREEDNG-03: All randomness resolved server-side using a deterministic seed stored on the egg record.
- FR-BREEDNG-04: Breeding costs, parent cooldowns, and lifetime caps enforced server-side:
  - Breed cost: Common 1,000 / Uncommon 2,000 / Rare 5,000 / Legendary 15,000 coins
  - Parent cooldown: 72 hours
  - Lifetime per-parent breed cap: 8
  - Account breed cap: 20 attempts/week
- FR-BREEDNG-05: Incubation durations: Common 12 h / Uncommon 24 h / Rare 48 h / Legendary 96 h.
- FR-BREEDNG-06: Players start with 1 incubator slot; additional slots purchasable.
- FR-BREEDNG-07: Care mini-game during incubation can bias inherit or composite chances slightly.
- FR-BREEDNG-08: Consumables (Selective Serum, Fertility Tonic, Accelerants) are rate-limited; consumable application logged.
- FR-BREEDNG-09: Uniqueness allocated atomically at hatch; collisions trigger up to 3 resolution attempts before fallback.
- FR-BREEDNG-10: Pedigree stored on hatched chicken (parentAId, parentBId, genomeSnapshot, mutationFlags, breederId, timestamps).

### 2.8 Rare Hybrid Promotion Pipeline

- FR-PROMO-01: An extremely rare mutation (~0.05% chance) at hatch may produce an `archetype_candidate`.
- FR-PROMO-02: Candidate must be legendary rarity OR have ≥ 2 high-tier modifiers AND composite flag.
- FR-PROMO-03: Candidate dossier auto-populated with telemetry (pick/use/win rates, trade volume, anomalies).
- FR-PROMO-04: Candidate remains instance-level for minimum 7 days.
- FR-PROMO-05: Promotion requires designer sign-off and systems engineer sign-off; no automated promotion.
- FR-PROMO-06: On promotion: archetype record created, canonical assets assigned, original breeder receives badge + cosmetic.
- FR-PROMO-07: Staged rollback/deprecation plan available; existing instances preserved on deprecation.

### 2.9 Economy

- FR-ECON-01: Currency: coins (soft currency, earnable in-game and purchasable).
- FR-ECON-02: Currency sinks: breeding fees, respec fees, accelerants, incubator slot purchases.
- FR-ECON-03: Direct chicken trading allowed; temporary trade locks on rare/legendary hatches (24–72 h).
- FR-ECON-04: Consumables obtainable via gameplay and limited events; permanent ability upgrades via events only.

---

## 3. Non-Functional Requirements

### 3.1 Performance

- NFR-PERF-01: App cold start ≤ 3 s on mid-range Android device (2 GB RAM, 2.0 GHz CPU).
- NFR-PERF-02: Map screen renders within 1.5 s of foreground return.
- NFR-PERF-03: Hatch job completes and returns result within 3 s P99.
- NFR-PERF-04: Breeding preview endpoint latency ≤ 500 ms P95.
- NFR-PERF-05: Respec confirm endpoint latency ≤ 800 ms P95.
- NFR-PERF-06: API throughput: sustain 500 RPS on core endpoints without degradation.

### 3.2 Reliability & Availability

- NFR-REL-01: Firebase Firestore used as primary data store (multi-region, SLA ≥ 99.95%).
- NFR-REL-02: Cloud Functions retry policy: max 3 retries with exponential backoff for background jobs.
- NFR-REL-03: Idempotent endpoints must return consistent results for duplicate requests within 10 minutes.
- NFR-REL-04: Hatch job is an idempotent operation; re-triggering with same eggId produces same result or returns existing hatch result.

### 3.3 Security

- NFR-SEC-01: All API calls authenticated via Firebase ID token (JWT).
- NFR-SEC-02: Firestore security rules enforce ownership and role-based access; clients never write game-critical fields directly.
- NFR-SEC-03: All monetary and game-state mutations executed in Cloud Functions (server-side only).
- NFR-SEC-04: No RNG seeds or genome blobs writable by the client.
- NFR-SEC-05: Rate limiting on all public endpoints (see Section 10).

### 3.4 Scalability

- NFR-SCALE-01: Architecture must handle 10,000 concurrent active sessions without code changes (Firebase auto-scales).
- NFR-SCALE-02: Firestore collection structure designed to avoid hot documents (fan-out pattern for high-traffic paths).

### 3.5 Accessibility

- NFR-ACC-01: All interactive UI elements include content descriptions for TalkBack.
- NFR-ACC-02: Minimum touch target size 48 × 48 dp.
- NFR-ACC-03: Color contrast ratio ≥ 4.5:1 for all text.
- NFR-ACC-04: No information conveyed by color alone.

### 3.6 Localization

- NFR-L10N-01: All player-facing strings in `res/values/strings.xml`; no hardcoded strings in Kotlin or Compose.
- NFR-L10N-02: Initial release: English (en-US) only. Hawaiian (haw) added in v1.1.

### 3.7 Data Retention & Privacy

- NFR-PRIV-01: Comply with Google Play data safety requirements.
- NFR-PRIV-02: Precise location stored only in memory during session; never persisted to Firestore.
- NFR-PRIV-03: PII (email, display name) not stored in game documents; reference userId only.
- NFR-PRIV-04: Telemetry events are anonymized at collection (userId hashed for aggregation).

---

## 4. System Architecture

### 4.1 High-Level Diagram

```
[Android Client]
      |
      | HTTPS + Firebase SDK (gRPC)
      v
[Firebase Auth] ──────────────────────────────────────────────────────┐
      |                                                                 |
      v                                                                 |
[Cloud Functions for Firebase]  <── [Firestore]  <── [Firebase Storage]|
      |                                                                 |
      |── BreedingService                                               |
      |── HatchService                                                  |
      |── RespecService                                                 |
      |── UniqueModifierRegistry                                        |
      |── SpawnService                                                  |
      |── EconomyService                                                |
      |── TelemetryService ────────────────────────────────────────────┘
      |
      v
[BigQuery / Firebase Analytics]  <── [Looker Studio Dashboards]
```

### 4.2 Component Summary

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Android Client | Kotlin / Jetpack Compose / Google Maps SDK | UI, local state, API calls |
| Firebase Auth | Firebase Authentication | Identity, JWT issuance |
| Cloud Functions | Node.js (TypeScript) v2 | All game logic mutations |
| Firestore | Cloud Firestore (Native mode) | Primary data store |
| Firebase Storage | Google Cloud Storage | Chicken/egg visual assets |
| Firebase Analytics | Firebase Analytics SDK | Client event collection |
| BigQuery | Google BigQuery | Analytical queries, dashboards |
| Looker Studio | Looker Studio | Operational dashboards |

### 4.3 Data Flow: Breed → Hatch

```
1. Client calls POST /api/breeding/preview  (read-only)
2. BreedingService computes probabilities, returns preview (no writes)
3. Client shows preview UI; player confirms
4. Client calls POST /api/breeding/confirm (with idempotency token)
5. BreedingService:
   a. Validates ownership, caps, cooldowns (transaction read)
   b. Deducts breed cost from player balance
   c. Creates egg document (genomeSeedBlob, rarity, incubationEndsAt)
   d. Sets parentA/parentB lastBreedAt and increments breedCount
   e. Writes breeding_history entry
   f. Returns eggId
6. Client polls or awaits FCM push at incubationEndsAt
7. Client calls POST /api/eggs/{eggId}/hatch
8. HatchService:
   a. Validates eggId and ownership (idempotency check)
   b. Resolves genome using deterministic RNG from genomeSeedBlob
   c. Calls UniqueModifierRegistry.allocate() (atomic transaction)
   d. Creates chicken document
   e. Updates egg status to "hatched"
   f. Writes breeding_history.resultChickenId
   g. Returns hatched chicken data
```

### 4.4 Transaction Boundaries

| Operation | Firestore Transaction Scope |
|-----------|-----------------------------|
| Breed confirm | player balance, parentA, parentB, egg, breeding_history |
| Hatch | egg, unique_modifier_registry entry, chicken, breeding_history update |
| Respec (paid) | player balance, chicken (nodes reset, counters), respec_history |
| Respec (free) | chicken (nodes reset, flag), respec_history |
| Promote archetype | archetype_candidates entry, archetype_catalog entry, unique_modifier_registry update |

---

## 5. Data Model — Firestore Schemas

All collections use Firestore Native mode. Document IDs are auto-generated UUIDs unless noted. All timestamps are Firestore `Timestamp` (UTC). All collections include `schemaVersion: number` (default 1).

### 5.1 `players/{userId}`

```json
{
  "userId": "string",
  "displayName": "string",
  "coinBalance": "number",
  "incubatorSlots": "number",
  "breedAttemptsThisWeek": "number",
  "weekResetAt": "Timestamp",
  "trainingPointsAppliedThisWeek": "number",
  "schemaVersion": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### 5.2 `chickens/{chickenId}`

```json
{
  "chickenId": "string",
  "ownerId": "string",
  "archetypeId": "string | null",
  "breedId": "string | null",
  "nativeAreaId": "string | null",
  "primaryClass": "Air | Ground | Ocean",
  "secondaryTraits": ["string"],
  "compositeFlag": "boolean",
  "rarity": "common | uncommon | rare | legendary",
  "level": "number",
  "xp": "number",
  "unspentSkillPoints": "number",
  "assignedNodes": {
    "node_primary_damage_1": true,
    "node_primary_cost_1": false
  },
  "trainingValueSpent": "number",
  "freeRespecUsed": "boolean",
  "respecPaidCount": "number",
  "primaryAbility": {
    "templateId": "string",
    "params": {
      "damage": "number",
      "energyCost": "number",
      "cooldownMs": "number",
      "range": "number"
    },
    "uniqueModifierTag": "string"
  },
  "ultimateAbility": {
    "templateId": "string",
    "params": {
      "damage": "number",
      "energyCostThreshold": "number",
      "cooldownMs": "number",
      "aoeRadius": "number"
    },
    "uniqueModifierTag": "string"
  },
  "stats": {
    "hp": "number",
    "armor": "number",
    "energyCap": "number",
    "energyRegen": "number",
    "speed": "number"
  },
  "visualRefs": {
    "modelId": "string",
    "skinId": "string",
    "vfxPaletteId": "string",
    "thumbnailUrl": "string"
  },
  "genomeSnapshot": {
    "rngSeed": "string",
    "classGene": { "primary": "string", "secondary": ["string"] },
    "statGenes": { "hp": "number", "armor": "number", "energyCap": "number", "energyRegen": "number", "speed": "number" },
    "primaryAbilityGene": { "templateId": "string", "paramSeeds": {}, "uniqueModifierSeedCandidate": "string" },
    "ultimateAbilityGene": { "templateId": "string", "paramSeeds": {}, "uniqueModifierSeedCandidate": "string" },
    "visualGenes": { "palette": "string", "crestShape": "string", "accessorySet": "string" }
  },
  "pedigree": {
    "parentAId": "string | null",
    "parentBId": "string | null",
    "breederId": "string",
    "mutationFlags": ["string"],
    "hatchedAt": "Timestamp"
  },
  "chickenState": "standard | archetype_candidate | promoted_archetype",
  "tradeLockUntil": "Timestamp | null",
  "breedCount": "number",
  "lastBreedAt": "Timestamp | null",
  "schemaVersion": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### 5.3 `eggs/{eggId}`

```json
{
  "eggId": "string",
  "ownerId": "string",
  "parentAId": "string",
  "parentBId": "string",
  "breederId": "string",
  "rarity": "common | uncommon | rare | legendary",
  "incubationEndsAt": "Timestamp",
  "genomeSeedBlob": {
    "rngSeed": "string",
    "parentASnapshot": {},
    "parentBSnapshot": {},
    "consumableModifiers": {}
  },
  "careModifiers": {
    "compositeChanceDelta": "number",
    "inheritanceBiasSeed": "string"
  },
  "classPreview": {
    "Air": "number",
    "Ground": "number",
    "Ocean": "number",
    "compositeChance": "number"
  },
  "status": "incubating | hatched | cancelled",
  "resultChickenId": "string | null",
  "hatchAttempts": "number",
  "schemaVersion": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### 5.4 `unique_modifier_registry/{tag}`

```json
{
  "tag": "string",
  "assigned": "boolean",
  "assignedChickenId": "string | null",
  "allowedClasses": ["Air", "Ground", "Ocean"],
  "provenance": "designer | breeding | mutation",
  "authorId": "string",
  "assignedAt": "Timestamp | null",
  "metadata": {
    "description": "string",
    "paramBounds": {}
  }
}
```

### 5.5 `respec_history/{id}`

```json
{
  "id": "string",
  "chickenId": "string",
  "actorUserId": "string",
  "createdAt": "Timestamp",
  "free": "boolean",
  "feeCharged": "number",
  "refundGiven": "number",
  "trainingValueSpentBefore": "number",
  "respecPaidCountBefore": "number",
  "idempotencyToken": "string",
  "notes": "string"
}
```

### 5.6 `breeding_history/{id}`

```json
{
  "id": "string",
  "actorUserId": "string",
  "parentAId": "string",
  "parentBId": "string",
  "eggId": "string",
  "costPaid": "number",
  "consumablesUsed": [{ "itemId": "string", "qty": "number" }],
  "resultChickenId": "string | null",
  "mutationHappened": "boolean",
  "collisionResolutionAttempts": "number",
  "archetypeCandidateFlagged": "boolean",
  "createdAt": "Timestamp",
  "hatchedAt": "Timestamp | null"
}
```

### 5.7 `archetype_candidates/{id}`

```json
{
  "id": "string",
  "chickenId": "string",
  "ownerId": "string",
  "genomeSnapshot": {},
  "telemetrySummary": {
    "distinctHatchers": "number",
    "matchUses": "number",
    "avgPickRate": "number",
    "avgWinRate": "number",
    "tradeVolume": "number",
    "anomalyFlags": ["string"]
  },
  "reviewStatus": "pending | approved | declined | promoted",
  "reviewedBy": "string | null",
  "reviewNotes": "string",
  "tradeLockUntil": "Timestamp",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### 5.8 `archetype_catalog/{archetypeId}`

```json
{
  "archetypeId": "string",
  "name": "string",
  "primaryClass": "Air | Ground | Ocean",
  "secondaryTraitPool": ["string"],
  "abilityTemplates": {
    "primary": {
      "templateId": "string",
      "baseDamage": "number",
      "baseEnergyCost": "number",
      "baseCooldownMs": "number",
      "baseRange": "number",
      "paramBounds": {
        "damage": [0, 120],
        "energyCost": [10, 60],
        "cooldownMs": [500, 5000],
        "range": [1, 20]
      }
    },
    "ultimate": {
      "templateId": "string",
      "baseDamage": "number",
      "baseEnergyCostThreshold": "number",
      "baseCooldownMs": "number",
      "baseAoeRadius": "number",
      "paramBounds": {}
    }
  },
  "statBounds": {
    "hp": [80, 200],
    "armor": [0, 50],
    "energyCap": [50, 150],
    "energyRegen": [2, 10],
    "speed": [1, 10]
  },
  "antiSynergyBlacklist": [["swimAffinity", "chargeArmor"]],
  "provenance": "designer | promoted_from_candidate",
  "originCandidateId": "string | null",
  "createdAt": "Timestamp"
}
```

### 5.9 `areas/{areaId}`

```json
{
  "areaId": "string",
  "name": "string",
  "island": "kauai | oahu | maui | molokai | lanai | hawaii",
  "classification": "coastal | urban_inland | mountain_valley",
  "spawnConfig": {
    "breeds": [
      { "breedId": "string", "weight": "number", "rarity": "string" }
    ],
    "totalDailySpawns": "number",
    "eventBreeds": []
  },
  "geoPolygon": [[0.0, 0.0]],
  "active": "boolean"
}
```

### 5.10 Schema Versioning & Migration

- All collections include `schemaVersion: number` (default 1).
- Migrations are Cloud Functions triggered manually or via Cloud Scheduler.
- Migration scripts live in `functions/src/migrations/vN_description.ts`.
- Each migration is idempotent; completion tracked in `migrations/{version}` Firestore document.
- Backward-incompatible changes bump `schemaVersion`; old clients must be forced to upgrade before migration executes.

---

## 6. API Contract

All callable functions are deployed as Firebase Cloud Functions v2 HTTPS callables. Authentication via Firebase Auth ID token in the `Authorization: Bearer <token>` header (enforced by Firebase App Check + custom middleware).

### 6.1 Error Model

All error responses:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

HTTP status mapping:

| Status | Condition |
|--------|-----------|
| 200 | Success |
| 400 | Validation error, bad input |
| 401 | Missing or invalid auth token |
| 403 | Ownership violation, forbidden action |
| 404 | Resource not found |
| 409 | Conflict (cap exceeded, cooldown active) |
| 422 | Business rule violation (insufficient balance) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Temporary unavailability |

### 6.2 Retry Semantics

- GET / preview endpoints: retry freely (idempotent reads).
- Mutation endpoints: include `X-Idempotency-Token: <uuid>` header. Server stores token result for 10 minutes; duplicate requests within window return cached result.
- Clients retry 5xx with exponential backoff (initial 1 s, max 30 s, max 3 retries).
- 409 and 422 are not retryable without user action.

### 6.3 Breeding Endpoints

#### POST /api/breeding/preview

Read-only. No writes.

**Request:**
```json
{
  "parentAId": "string",
  "parentBId": "string",
  "consumables": [{ "itemId": "string", "qty": 1 }]
}
```

**Validation:**
- Both parentIds owned by authenticated user.
- Both parents: breedCount < 8 and not in 72-hour cooldown.
- Consumable itemIds valid; quantities within inventory.

**Response 200:**
```json
{
  "classProbabilities": { "Air": 0.45, "Ground": 0.50, "Ocean": 0.05 },
  "compositeChance": 0.20,
  "mutationChance": 0.03,
  "abilityOrigin": {
    "primary": { "parentA": 0.47, "parentB": 0.38, "blend": 0.12, "mutation": 0.03 },
    "ultimate": { "parentA": 0.47, "parentB": 0.38, "blend": 0.12, "mutation": 0.03 }
  },
  "eggRarityDistribution": { "common": 0.60, "uncommon": 0.30, "rare": 0.09, "legendary": 0.01 },
  "cost": { "coins": 1000, "consumableValue": 200, "total": 1200 },
  "incubationSeconds": 43200,
  "previewSeedHash": "sha256:abc123"
}
```

**Error codes:** `PARENT_NOT_FOUND`, `NOT_OWNER`, `BREED_COOLDOWN_ACTIVE`, `LIFETIME_CAP_REACHED`, `INVALID_CONSUMABLE`

---

#### POST /api/breeding/confirm

Transactional. Requires idempotency token.

**Headers:** `X-Idempotency-Token: <uuid>`

**Request:**
```json
{
  "parentAId": "string",
  "parentBId": "string",
  "consumables": [{ "itemId": "string", "qty": 1 }],
  "confirmedCost": 1200
}
```

**Additional validation:** `confirmedCost` matches server-computed cost; `breedAttemptsThisWeek` < 20; player `coinBalance` ≥ cost.

**Response 200:**
```json
{
  "eggId": "string",
  "incubationEndsAt": "2026-04-08T14:00:00Z",
  "rarity": "rare",
  "message": "Egg is incubating."
}
```

**Error codes:** `INSUFFICIENT_BALANCE`, `WEEKLY_CAP_EXCEEDED`, `COST_MISMATCH`, plus all preview errors.

---

#### GET /api/eggs/{eggId}

**Response 200:**
```json
{
  "eggId": "string",
  "rarity": "rare",
  "incubationEndsAt": "2026-04-08T14:00:00Z",
  "status": "incubating",
  "classPreview": { "Air": 0.45, "Ground": 0.50, "Ocean": 0.05, "compositeChance": 0.20 },
  "careModifiers": {}
}
```

---

#### POST /api/eggs/{eggId}/hatch

Idempotent. Safe to retry.

**Headers:** `X-Idempotency-Token: <uuid>`

**Request:** `{}` (empty body)

**Validation:** Egg `status == "incubating"` and `incubationEndsAt` ≤ now.

**Response 200:**
```json
{
  "chickenId": "string",
  "name": "string",
  "primaryClass": "Air",
  "secondaryTraits": ["swimAffinity"],
  "compositeFlag": true,
  "rarity": "rare",
  "primaryAbility": { "templateId": "string", "params": {}, "uniqueModifierTag": "string" },
  "ultimateAbility": { "templateId": "string", "params": {}, "uniqueModifierTag": "string" },
  "stats": {},
  "visualRefs": {},
  "pedigree": { "parentAId": "string", "parentBId": "string", "hatchedAt": "2026-04-08T14:01:22Z" },
  "collisionResolved": false,
  "collisionAttempts": 0,
  "archetypeCandidateFlagged": false
}
```

**Error codes:** `EGG_NOT_FOUND`, `NOT_OWNER`, `NOT_READY`, `HATCH_FAILED`

---

#### POST /api/eggs/{eggId}/accelerate

**Request:** `{ "itemId": "string", "qty": 1 }`

**Response 200:** `{ "newIncubationEndsAt": "Timestamp" }`

---

#### POST /api/eggs/{eggId}/careAction

**Request:** `{ "actionType": "string", "actionData": {} }`

**Response 200:** `{ "applied": true, "careModifiersUpdated": {} }`

---

### 6.4 Respec Endpoints

#### GET /api/chickens/{chickenId}/respec/preview

**Response 200:**
```json
{
  "free": false,
  "trainingValueSpent": 10000,
  "refundAmount": 5000,
  "fee": 2000,
  "feeEscalated": 2500,
  "net": 2500,
  "balanceRequired": 2000,
  "currentBalance": 8500,
  "canAfford": true,
  "assignedNodes": ["node_primary_damage_1"],
  "unspentSkillPointsAfterReset": 12
}
```

**Error codes:** `CHICKEN_NOT_FOUND`, `NOT_OWNER`

---

#### POST /api/chickens/{chickenId}/respec

Idempotent. Requires idempotency token.

**Headers:** `X-Idempotency-Token: <uuid>`

**Request:** `{ "confirm": true }`

**Response 200:**
```json
{
  "result": "success",
  "free": false,
  "feeCharged": 2000,
  "refundGiven": 5000,
  "net": 3000,
  "newBalance": 11500,
  "unspentSkillPoints": 12,
  "respecHistoryId": "string"
}
```

**Error codes:** `CHICKEN_NOT_FOUND`, `NOT_OWNER`, `INSUFFICIENT_BALANCE`

---

### 6.5 Chicken Endpoints

#### GET /api/chickens/{chickenId}

Returns full chicken document (genomeSnapshot internals hidden from non-owner).

#### GET /api/chickens

Query params: `ownerId`, `areaId`, `primaryClass`, `rarity`, `pageSize` (max 50), `pageToken`.

#### POST /api/chickens/{chickenId}/assignSkillPoint

**Request:** `{ "nodeId": "string" }`

**Validation:** `unspentSkillPoints > 0`; node valid; prerequisites met; no anti-synergy violation.

**Response 200:** `{ "assignedNodes": {}, "unspentSkillPoints": 11 }`

---

### 6.6 Admin Endpoints (require `admin` custom claim)

#### GET /admin/archetypeCandidates

Returns paginated list. Filter by `reviewStatus`.

#### POST /admin/archetypeCandidates/{id}/review

**Request:** `{ "decision": "approved | declined", "notes": "string", "tunedParams": {} }`

#### POST /admin/promoteCandidate

**Request:** `{ "candidateId": "string", "archetypeId": "string", "canonicalParams": {}, "canonicalAssets": {} }`

Atomically creates `archetype_catalog` entry, updates `unique_modifier_registry`, updates chicken record, notifies player.

#### GET /admin/uniqueModifiers

Returns registry entries. Supports filter by `assigned`.

---

## 7. Frontend Architecture & Screen Specs

### 7.1 Architecture

- **Language:** Kotlin
- **UI framework:** Jetpack Compose (Material 3)
- **Navigation:** Jetpack Navigation Compose with typed routes
- **State management:** ViewModel + StateFlow + UiState sealed class
- **Network:** Retrofit + OkHttp; Firebase SDK for Firestore/Auth/Functions
- **Maps:** Google Maps Compose SDK
- **DI:** Hilt
- **Image loading:** Coil
- **Build:** Gradle (Kotlin DSL)

### 7.2 Project Module Structure

```
app/
  src/main/
    java/com/cluckymoa/
      auth/           – AuthViewModel, LoginScreen
      map/            – MapScreen, SpawnOverlay, AreaInfoSheet
      catalogue/      – CatalogueScreen, BreedDetailScreen
      inventory/      – InventoryScreen, ChickenDetailScreen
      skilltree/      – SkillTreeScreen, SkillNodeComponent, RespecFlow
      breeding/       – BreedingParentSelectScreen, BreedPreviewScreen, BreedConfirmScreen
      incubator/      – IncubatorScreen, EggCardComponent, CareMinigameScreen
      hatch/          – HatchRevealScreen, PedigreeScreen
      economy/        – WalletComponent, ShopScreen
      admin/          – CandidateDossierScreen, PromoteArchetypeScreen
      core/
        ui/            – Design tokens, shared components
        network/       – API clients, interceptors
        data/          – Repositories, Firestore data sources
        domain/        – Use cases, business logic wrappers
```

### 7.3 Design Tokens

```kotlin
object CluckyColors {
    val airPrimary    = Color(0xFF5BC4F5)
    val groundPrimary = Color(0xFF8B5E3C)
    val oceanPrimary  = Color(0xFF1A6E8C)
    val rarityCommon    = Color(0xFFB0BEC5)
    val rarityUncommon  = Color(0xFF4CAF50)
    val rarityRare      = Color(0xFF2196F3)
    val rarityLegendary = Color(0xFFFFD700)
}
object CluckySpacing {
    val xs = 4.dp; val sm = 8.dp; val md = 16.dp; val lg = 24.dp; val xl = 32.dp
}
```

### 7.4 Screen Specifications

#### 7.4.1 Login Screen
- Google Sign-In button centered.
- On success: navigate to MapScreen.
- On failure: show error snackbar.
- Accessibility: button has `contentDescription = "Sign in with Google"`.

#### 7.4.2 Map Screen
- Full-screen Google Maps.
- Spawn markers (class-colored pins) overlaid.
- Bottom sheet: player stats (coins, active eggs count).
- FAB: open InventoryScreen.
- Tap spawn marker → encounter flow.
- Area boundaries shown as semi-transparent overlays.
- Location permission request on first launch with rationale dialog.

#### 7.4.3 Catalogue Screen
- List of all archetypes + regional variants.
- Filter bar: island, area, class, rarity.
- Each item: BreedCard (thumbnail, name, class badge, rarity badge, ability name preview).
- Tap → BreedDetailScreen.

#### 7.4.4 Breed Detail Screen
- Hero image with class VFX overlay.
- StatBar for hp, armor, energyCap, speed.
- AbilityRow (name, energy cost, cooldown, description, uniqueModifierTag).
- Spawn info: area name, island, classification.
- "Why unique" tooltip.
- If owned: "View My Chicken" button.

#### 7.4.5 Inventory Screen
- Grid/list of owned chickens.
- Filter: class, rarity, level.
- ChickenCard per item with quick actions: Battle / Breed / Manage.

#### 7.4.6 Chicken Detail Screen
- Full stats, current skill tree state, abilities.
- Buttons: Upgrade Skill → SkillTreeScreen, Breed → BreedingParentSelectScreen, Respec → RespecFlow.
- Pedigree preview (parents' thumbnails).

#### 7.4.7 Skill Tree Screen
- Visual node graph rendered as Compose Canvas.
- Nodes: locked (grey), available (class color), assigned (filled).
- Tap available node: tooltip with effect; confirm assigns and calls `POST /api/chickens/{id}/assignSkillPoint`.
- Unspent points badge.
- Respec button at bottom → RespecFlow.

#### 7.4.8 Respec Flow

**Step 1 — Preview dialog:**
- Show `free`, `refundAmount`, `fee`, `net`, `balanceRequired`, `canAfford`.
- If `!canAfford`: disable confirm button, show "Insufficient coins".
- Copy: "This will reset all skill tree assignments. Confirm?"

**Step 2 — Confirm:**
Calls `POST /api/chickens/{id}/respec` with idempotency token.

**Step 3 — Result:**
- Show coins delta with animation.
- Return to SkillTreeScreen with reset state.

#### 7.4.9 Breeding Parent Select Screen
- Two parent slots.
- List of eligible chickens (not in cooldown, breedCount < 8).
- Consumable picker.
- "Preview" enabled when both parents selected.

#### 7.4.10 Breed Preview Screen
- ProbabilityBar for class probabilities.
- Composite chance indicator.
- Ability origin breakdown (parentA / parentB / blend / mutation).
- Egg rarity distribution chart.
- Cost breakdown and incubation time.
- "Confirm Breed" → BreedConfirmScreen.

#### 7.4.11 Breed Confirm Screen
- Summary card: both parents, total cost.
- ConfirmModal.
- On confirm: call `POST /api/breeding/confirm`.
- On success: navigate to IncubatorScreen.

#### 7.4.12 Incubator Screen
- List of incubating eggs (EggCard per slot).
- EggCard: rarity badge, class preview, TimerBadge countdown.
- Accelerant and care mini-game buttons.
- "Hatch!" button when timer expired.

#### 7.4.13 Care Mini-Game Screen
- Interactive mini-game (tap/swipe pattern).
- Server validates timing (rejects < 200 ms actions).
- On completion: calls `POST /api/eggs/{id}/careAction`.

#### 7.4.14 Hatch Reveal Screen
- Animated reveal: egg cracks, chicken emerges.
- Show: class badge, secondaryTraits (if composite), rarity.
- Abilities card: inheritance source per ability (parentA / parentB / Blended / Mutated).
- PedigreeTree mini-view.
- If `collisionResolved == true`: note "Signature fine-tuned for uniqueness."
- If `archetypeCandidateFlagged == true`: golden banner "Exceptional hybrid! Dossier submitted for review."
- "Add to Collection" → ChickenDetailScreen.

#### 7.4.15 Pedigree Screen
- Expandable tree (up to 3 generations).
- PedigreeTree component: thumbnail, name, class, rarity per node.
- Composite indicator on hybrid nodes.

#### 7.4.16 Admin — Candidate Dossier Screen (admin claim required)
- Table of `archetype_candidates` with status filter.
- Row expand: genome snapshot, telemetrySummary, owner info.
- Actions: Approve, Decline, Promote.

#### 7.4.17 Admin — Promote Archetype Screen
- Pre-populated from candidate data.
- Editable fields: archetypeId, name, tunedParams, assetRefs.
- Balance simulation results panel.
- Confirm calls `POST /admin/promoteCandidate`.

### 7.5 Shared Components

| Component | Key Props | Notes |
|-----------|-----------|-------|
| `BreedCard` | chicken, onClick | class-colored border |
| `StatBar` | label, value, maxValue, color | Material linear progress |
| `AbilityRow` | name, energyCost, cooldown, tag, description | expandable |
| `ProbabilityBar` | label, probability, color | shows % text |
| `ConfirmModal` | title, body, onConfirm, onDismiss | blocks interaction |
| `TimerBadge` | targetTimestamp | live countdown |
| `PedigreeTree` | pedigree, depth | recursive Compose |
| `EggCard` | egg, onHatch, onAccelerate | rarity-colored |
| `RarityBadge` | rarity | colored chip |
| `ClassBadge` | primaryClass | icon + label |

### 7.6 Navigation Graph

```kotlin
NavHost(startDestination = "login") {
  composable("login")                              { LoginScreen() }
  composable("map")                                { MapScreen() }
  composable("catalogue")                          { CatalogueScreen() }
  composable("catalogue/{breedId}")                { BreedDetailScreen() }
  composable("inventory")                          { InventoryScreen() }
  composable("inventory/{chickenId}")              { ChickenDetailScreen() }
  composable("inventory/{chickenId}/skilltree")    { SkillTreeScreen() }
  composable("inventory/{chickenId}/respec")       { RespecFlow() }
  composable("breeding/select")                    { BreedingParentSelectScreen() }
  composable("breeding/preview")                   { BreedPreviewScreen() }
  composable("breeding/confirm")                   { BreedConfirmScreen() }
  composable("incubator")                          { IncubatorScreen() }
  composable("incubator/{eggId}/care")             { CareMinigameScreen() }
  composable("hatch/{eggId}")                      { HatchRevealScreen() }
  composable("pedigree/{chickenId}")               { PedigreeScreen() }
  composable("admin/candidates")                   { CandidateDossierScreen() }
  composable("admin/promote/{candidateId}")        { PromoteArchetypeScreen() }
}
```

---

## 8. Backend Architecture & Service Boundaries

### 8.1 Cloud Functions Structure

```
functions/src/
  index.ts
  services/
    BreedingService.ts
    HatchService.ts
    RespecService.ts
    UniqueModifierRegistry.ts
    SpawnService.ts
    EconomyService.ts
    TelemetryService.ts
    ArchetypePromotionService.ts
  middleware/
    auth.ts
    rateLimit.ts
    idempotency.ts
    appCheck.ts
  migrations/
    v1_initial.ts
  utils/
    deterministicRng.ts
    genomeResolver.ts
    abilityBlender.ts
    classResolver.ts
  types/
    Chicken.ts  Egg.ts  Player.ts  Area.ts  Archetype.ts
```

### 8.2 Service Responsibilities

**BreedingService**
- `computePreview(parentA, parentB, consumables)` → pure computation, no writes
- `confirmBreed(userId, parentAId, parentBId, consumables, idempotencyToken)` → Firestore transaction

**HatchService**
- `hatch(userId, eggId, idempotencyToken)` → Firestore transaction
- Calls `genomeResolver.resolve(egg.genomeSeedBlob)` → genome
- Calls `UniqueModifierRegistry.allocate(candidateTag)` → allocated tag

**RespecService**
- `previewRespec(chickenId, userId)` → read-only calculation
- `confirmRespec(chickenId, userId, idempotencyToken)` → Firestore transaction

**UniqueModifierRegistry**
- `allocate(candidateTag, chickenId)` → atomic Firestore transaction; returns tag or throws
- `release(tag)` → admin only
- Collision resolution: nudge → compose alternate → reroll (internal)

**SpawnService**
- `getSpawnsForArea(areaId, userId)` → spawn list from area config + weights
- `captureChicken(userId, breedId, areaId)` → validates location, creates chicken

**EconomyService**
- `debit(userId, amount, reason)` / `credit(userId, amount, reason)` → atomic balance updates; called by other services only

**TelemetryService**
- `logEvent(eventName, properties)` → Firebase Analytics / BigQuery stream
- Daily aggregation job for candidate dossier metrics (Cloud Scheduler)

**ArchetypePromotionService**
- `reviewCandidate(candidateId, decision, adminUserId, notes, tunedParams)` → updates candidate record
- `promoteCandidate(candidateId, archetypeId, params, assets, adminUserId)` → atomic promotion transaction

### 8.3 Background Jobs

| Job | Trigger | Action |
|-----|---------|--------|
| `weeklyCapReset` | Cloud Scheduler: Mon 00:00 UTC | Reset `breedAttemptsThisWeek`, `trainingPointsAppliedThisWeek` |
| `telemetryAggregator` | Cloud Scheduler: daily 02:00 UTC | Aggregate candidate dossier metrics |
| `tradeLockCleaner` | Cloud Scheduler: hourly | Remove expired trade locks |
| `spawnRefresh` | Cloud Scheduler: every 4 h | Refresh spawn weights per area |

---

## 9. Algorithms — Deterministic Pseudocode

### 9.1 RNG Foundation

```
// All randomness uses a seeded PRNG (Xoshiro256** or equivalent).
// Seed is sha256(parentAId + ":" + parentBId + ":" + timestamp_ms + ":" + server_nonce).
// Seed stored in egg.genomeSeedBlob.rngSeed.
// Reproducible: same seed always produces same output sequence.

function createRng(seed: string): Rng {
    return new Xoshiro256(hexToUint64Array(seed))
}
```

### 9.2 Class Resolution

```
SECONDARY_TRAIT_POOLS = {
    Air:    ["glideAffinity", "aerialEvasion", "windPush"],
    Ground: ["chargeArmor", "groundStomp", "burrowStability"],
    Ocean:  ["swimAffinity", "tidalPush", "surfBuff"]
}

function resolveClass(parentA, parentB, rng, consumableModifiers):

    // Step 1: Compute parent weights
    wA = parentA.classDominance  // default 0.5
    wB = 1.0 - wA
    rarityBonusA = rarityTierIndex(parentA.rarity) * 0.03  // tier: common=0, uncommon=1, rare=2, legendary=3
    rarityBonusB = rarityTierIndex(parentB.rarity) * 0.03
    wA = clamp(wA + rarityBonusA, 0.1, 0.9)
    wB = clamp(wB + rarityBonusB, 0.1, 0.9)
    sum = wA + wB
    wA = wA / sum
    wB = wB / sum

    // Step 2: Pick dominant class
    dominantClass = (rng.nextFloat() < wA) ? parentA.primaryClass : parentB.primaryClass
    otherClass    = (dominantClass == parentA.primaryClass) ? parentB.primaryClass : parentA.primaryClass

    // Step 3: Compute composite chance
    if parentA.primaryClass == parentB.primaryClass:
        compositeChance = 0.0
    else:
        rarityBonus     = (rarityTierIndex(parentA.rarity) + rarityTierIndex(parentB.rarity)) * 0.05
        compositeChance = clamp(0.20 + rarityBonus + consumableModifiers.compositeChanceDelta, 0, 0.80)

    // Step 4: Resolve secondary traits
    if compositeChance > 0 and rng.nextFloat() < compositeChance:
        traitPool       = SECONDARY_TRAIT_POOLS[otherClass]
        numTraits       = (rng.nextFloat() < 0.3) ? 2 : 1
        secondaryTraits = shuffle(traitPool, rng).slice(0, numTraits)
        compositeFlag   = true
    else:
        secondaryTraits = []
        compositeFlag   = false

    return { primaryClass: dominantClass, secondaryTraits, compositeFlag }
```

### 9.3 Secondary Trait Magnitudes

```
TRAIT_MAGNITUDES = {
    glideAffinity:   { jumpHeightBonus: 0.10 },
    aerialEvasion:   { evasionBonus: 0.08 },
    windPush:        { knockbackBonus: 0.12 },
    chargeArmor:     { armorBonus: 0.10 },
    groundStomp:     { aoeRadiusBonus: 0.08 },
    burrowStability: { statusResistBonus: 0.10 },
    swimAffinity:    { swimSpeedBonus: 0.10 },
    tidalPush:       { knockbackBonus: 0.08 },
    surfBuff:        { speedBonus: 0.06 }
}
// Magnitudes never exceed +15% on any single stat.
```

### 9.4 Stat Gene Resolution

```
function resolveStats(parentA, parentB, rng, archetypeId):
    bounds = ARCHETYPE_CATALOG[archetypeId].statBounds
    result = {}
    for stat in ["hp","armor","energyCap","energyRegen","speed"]:
        w    = rng.nextFloat()
        base = parentA.stats[stat] * w + parentB.stats[stat] * (1.0 - w)
        // Gaussian-like noise via Box-Muller approximation
        noise = (rng.nextFloat() + rng.nextFloat() - 1.0) * 0.12 * base
        result[stat] = clamp(round(base + noise), bounds[stat][0], bounds[stat][1])
    return result
```

### 9.5 Ability Gene Resolution

```
ABILITY_COMPATIBILITY_FAMILIES = {
    "dash":       ["groundDash","airDash","oceanDash"],
    "projectile": ["windBolt","waterSpear","mudShot"],
    "aoe":        ["stomachCrash","tidalWave","cycloneBlast"]
}

function resolveAbility(abilA, abilB, rng, paramBounds):

    // Mutation check (highest priority)
    if rng.nextFloat() < 0.03:
        return mutateAbility(abilA, abilB, rng)

    // Blend check
    if sameCompatibilityFamily(abilA.templateId, abilB.templateId):
        if rng.nextFloat() < 0.15:
            return blendAbility(abilA, abilB, rng, paramBounds)

    // Inherit from one parent
    return deepCopy((rng.nextFloat() < 0.5) ? abilA : abilB)

function blendAbility(abilA, abilB, rng, bounds):
    w      = rng.nextFloat()
    params = {}
    for param in abilA.params.keys():
        blended  = abilA.params[param] * w + abilB.params[param] * (1.0 - w)
        noise    = (rng.nextFloat() - 0.5) * 0.10 * blended
        params[param] = clamp(blended + noise, bounds[param][0], bounds[param][1])
    return {
        templateId: (w >= 0.5) ? abilA.templateId : abilB.templateId,
        params,
        uniqueModifierSeedCandidate: composeSeedCandidate(abilA, abilB, rng),
        blended: true
    }

function mutateAbility(abilA, abilB, rng):
    selected = MUTATION_ABILITY_POOL[rng.nextInt(MUTATION_ABILITY_POOL.length)]
    return { templateId: selected.templateId, params: selected.defaultParams,
             uniqueModifierSeedCandidate: selected.seedCandidate, mutated: true }
```

### 9.6 Unique Modifier Allocation

```
MAX_COLLISION_ATTEMPTS = 3

function allocateUniqueModifier(candidateTag, chickenId, db):
    // Must run inside a Firestore transaction

    for attempt in range(0, MAX_COLLISION_ATTEMPTS):
        doc = tx.get(db.collection("unique_modifier_registry").doc(candidateTag))
        if !doc.exists or doc.assigned == false:
            tx.set(doc.ref, {
                tag: candidateTag,
                assigned: true,
                assignedChickenId: chickenId,
                assignedAt: now(),
                provenance: "breeding"
            })
            return { tag: candidateTag, collisionResolved: attempt > 0, attempts: attempt + 1 }

        // Collision: compute alternate
        if attempt == 0:
            candidateTag = nudgeTag(candidateTag)           // append _v2, _v3, etc.
        elif attempt == 1:
            candidateTag = compositeAlternateTag(candidateTag, chickenId, rng)
        elif attempt == 2:
            throw RerollRequiredException(candidateTag)     // HatchService will re-seed genome

    throw HatchFailedException("Cannot allocate unique modifier")

function nudgeTag(tag):
    match = tag.match(/^(.+?)(_v(\d+))?$/)
    version = match[3] ? parseInt(match[3]) + 1 : 2
    return match[1] + "_v" + version

function compositeAlternateTag(tag, chickenId, rng):
    suffix = rng.nextInt(1000).toString().padStart(3, "0")
    return tag + "_h" + suffix
```

### 9.7 Full Hatch Resolution

```
function resolveHatch(egg, rng):
    // 1. Class
    { primaryClass, secondaryTraits, compositeFlag } =
        resolveClass(egg.parentA, egg.parentB, rng, egg.consumableModifiers)

    // 2. Archetype
    archetypeId = selectArchetype(primaryClass, secondaryTraits, egg.parentA, egg.parentB)

    // 3. Stats
    stats = resolveStats(egg.parentA, egg.parentB, rng, archetypeId)

    // 4. Abilities
    bounds   = ARCHETYPE_CATALOG[archetypeId].abilityTemplates
    primary  = resolveAbility(egg.parentA.primaryAbility, egg.parentB.primaryAbility, rng, bounds.primary.paramBounds)
    ultimate = resolveAbility(egg.parentA.ultimateAbility, egg.parentB.ultimateAbility, rng, bounds.ultimate.paramBounds)

    // 5. Visuals
    visualGenes = resolveVisuals(egg.parentA.visualGenes, egg.parentB.visualGenes, primaryClass, secondaryTraits, rng)

    // 6. Anti-synergy check
    validateAntiSynergy(primaryClass, secondaryTraits, primary, ultimate, archetypeId)
    // throws if forbidden combination

    // 7. Archetype candidate check
    mutationHappened        = primary.mutated OR ultimate.mutated
    archetypeCandidateFlag  = checkArchetypeCandidateEligibility(egg.rarity, primary, ultimate, mutationHappened, rng)

    return {
        primaryClass, secondaryTraits, compositeFlag, archetypeId,
        stats, primary, ultimate, visualGenes,
        mutationHappened, archetypeCandidateFlag,
        genomeSnapshot: buildGenomeSnapshot(rng.initialSeed, ...)
    }

function checkArchetypeCandidateEligibility(rarity, primary, ultimate, mutationHappened, rng):
    if !mutationHappened: return false
    isLegendary  = (rarity == "legendary")
    highTierCount = countHighTierModifiers(primary, ultimate)
    if !isLegendary and highTierCount < 2: return false
    return rng.nextFloat() < 0.0005
```

### 9.8 Respec Calculation

```
BASE_FEE = 2000
FEE_ESCALATION_PER_PAID_RESPEC = 500
REFUND_PCT = 0.50

function calculateRespec(chicken, player):
    if chicken.freeRespecUsed == false:
        return { free: true, fee: 0, refundAmount: 0, net: 0, balanceRequired: 0, canAfford: true }

    feeEscalation = chicken.respecPaidCount * FEE_ESCALATION_PER_PAID_RESPEC
    fee           = BASE_FEE + feeEscalation
    refundAmount  = floor(chicken.trainingValueSpent * REFUND_PCT)
    net           = refundAmount - fee
    return {
        free: false,
        fee, feeEscalation, refundAmount, net,
        balanceRequired: fee,
        canAfford: player.coinBalance >= fee
    }
```

---

## 10. Security, Anti-Abuse & Fraud Controls

### 10.1 Authentication & Authorization

- All Cloud Functions verify Firebase ID token via Firebase Admin SDK.
- Firebase App Check (Play Integrity API) enforces requests originate from legitimate app binary.
- Firestore security rules: clients can only read their own documents; no client writes to game-state fields.
- Admin endpoints require `admin: true` custom claim; set only via Firebase Admin SDK (never by the client).

### 10.2 Rate Limiting

All limits enforced server-side in Cloud Functions middleware.

| Endpoint | Limit |
|----------|-------|
| POST /api/breeding/preview | 60/min per user |
| POST /api/breeding/confirm | 5/min per user |
| POST /api/eggs/{id}/hatch | 10/min per user |
| POST /api/chickens/{id}/respec | 3/min per user |
| POST /api/chickens/{id}/assignSkillPoint | 20/min per user |
| Admin endpoints | 30/min per admin user |

Rate limit counters stored in Firestore `rate_limits/{userId}/{window}` (sliding 1-minute window).

### 10.3 Business Rule Caps

| Rule | Value |
|------|-------|
| Training item SP/week | 10 per account |
| Breed attempts/week | 20 per account |
| Lifetime breeds per parent | 8 |
| Parent cooldown | 72 h |
| Incubator slots default | 1 |

### 10.4 Trade Locks

- Common/Uncommon hatches: no trade lock.
- Rare hatches: 24-hour trade lock after hatch.
- Legendary hatches: 72-hour trade lock after hatch.
- Archetype candidates: trade locked until `archetype_candidates.tradeLockUntil` (minimum 7 days).
- Lock enforced in Firestore rules: transfer rejected if `chicken.tradeLockUntil > request.time`.

### 10.5 Anti-Bot Measures

- Firebase App Check blocks non-genuine clients.
- Care mini-game timing validated server-side; actions completing in < 200 ms rejected.
- Anomaly detection: > 10 breeds/hour per account triggers flag and human review queue.
- > 5 legendary egg hatches in 24 h triggers flag and temporary breed suspension.

### 10.6 Idempotency

- Idempotency tokens stored in `idempotency_tokens/{token}` with 10-minute TTL.
- Mutation endpoints check token before executing; return cached result on duplicate.
- Tokens are UUIDs generated client-side; malformed UUIDs rejected.

### 10.7 Data Integrity

- All balance mutations use Firestore transactions.
- `genomeSnapshot` is write-once (Firestore rule prevents client overwrites).
- `uniqueModifierTag` on a chicken is write-once after hatch.
- Admin promotion operations logged in `admin_audit_log/{id}` with actor, action, before/after state.

---

## 11. Telemetry, Analytics & Dashboards

### 11.1 Client Events (Firebase Analytics)

| Event Name | Trigger | Key Properties |
|-----------|---------|----------------|
| `login_success` | Auth sign-in | `userId`, `method` |
| `map_opened` | MapScreen visible | `areaId`, `island` |
| `spawn_encountered` | Wild chicken tapped | `breedId`, `rarity`, `areaId` |
| `chicken_captured` | Capture success | `breedId`, `rarity`, `method` |
| `breed_preview_shown` | Preview screen visible | `parentAClass`, `parentBClass`, `compositeChance` |
| `breed_confirmed` | Breed confirm success | `eggRarity`, `costPaid`, `consumablesUsed` |
| `egg_care_action` | Care mini-game completed | `eggId`, `actionType`, `modifierApplied` |
| `egg_hatched` | Hatch reveal shown | `chickenId`, `primaryClass`, `compositeFlag`, `mutationHappened`, `candidateFlagged` |
| `respec_preview_shown` | Respec preview loaded | `chickenId`, `free`, `fee`, `net` |
| `respec_confirmed` | Respec confirm success | `chickenId`, `free`, `feeCharged`, `refundGiven` |
| `skill_node_assigned` | Skill point spent | `chickenId`, `nodeId`, `unspentAfter` |
| `shop_purchase` | Item purchased | `itemId`, `category`, `coins` |

### 11.2 Server Events (Cloud Functions → BigQuery)

| Event Name | Trigger | Key Properties |
|-----------|---------|----------------|
| `breed_confirm_server` | BreedingService success | `userId`, `parentAId`, `parentBId`, `cost` |
| `hatch_complete` | HatchService success | `eggId`, `chickenId`, `collisionAttempts`, `candidateFlagged` |
| `unique_modifier_collision` | Registry collision | `candidateTag`, `attempts`, `resolution` |
| `respec_complete_server` | RespecService success | `chickenId`, `free`, `feeCharged`, `refundGiven` |
| `trade_lock_applied` | Hatch of rare+ chicken | `chickenId`, `rarity`, `lockDurationH` |
| `anomaly_detected` | Rate/volume anomaly | `userId`, `anomalyType`, `details` |
| `archetype_candidate_created` | Candidate flagged | `candidateId`, `chickenId`, `ownerId` |
| `archetype_promoted` | Admin promotion | `archetypeId`, `originCandidateId`, `adminUserId` |

### 11.3 Dashboards (Looker Studio)

**Breeding & Hatch Health**
- Daily breed attempts vs. hatch completions
- Cross-class rate, composite rate, mutation rate
- Egg rarity distribution
- Collision rate and resolution breakdown

**Balance & Fairness**
- Pick/use/win rate per archetype (7-day rolling)
- Stat distribution of hatched chickens (outlier detection)
- Respec rate and refund/fee ratio per breed

**Economy**
- Daily active coin sinks (breeding, respec, accelerants)
- Weekly breed attempt cap utilization
- Trade volume by rarity

**Anti-Abuse**
- Anomaly flag count and type breakdown
- Rate limit hit rate per endpoint
- Mass-breeding account flags

**Archetype Pipeline**
- Candidate count by status
- Candidate telemetry vs. baseline
- Time from creation to promotion/decline

### 11.4 Alerts

| Alert | Threshold | Action |
|-------|-----------|--------|
| Collision rate > 0.5% | 5-min window | Page on-call |
| Hatch P99 > 5 s | 10-min window | Page on-call |
| 5xx rate > 0.5% | 5-min window | Page on-call |
| Breed anomaly flags > 50/h | Hourly | Alert Slack channel |
| Win rate for any archetype > 65% | Daily | Alert balance team |
| Refunds consistently > fees (3 days) | Daily | Alert economy team |

---

## 12. Testing Strategy

### 12.1 Unit Tests

**Location:** `functions/src/tests/unit/`, `app/src/test/`

| Test Suite | Scope |
|-----------|-------|
| `ClassResolverTest` | All branches of `resolveClass()`: same class, max rarity, consumable modifiers, composite boundary |
| `AbilityResolverTest` | Inheritance, blending, mutation; fixed seeds produce deterministic output |
| `StatGeneResolverTest` | Clamp enforcement; variance within ±12%; archetype bounds never exceeded |
| `UniqueModifierRegistryTest` | Allocation success; nudge on collision; composite alternate; reroll trigger |
| `HatchServiceTest` | Full hatch flow with mocked Firestore; genomeSnapshot immutable; candidate flag |
| `RespecCalculationTest` | Free respec; paid respec (net positive, net zero, net negative); insufficient balance; fee escalation |
| `BreedingPreviewTest` | Class probabilities sum to 1.0; validation rejects bad parents; cost computation |
| `RateLimitTest` | Sliding window counter increments and resets correctly |
| `IdempotencyTest` | Duplicate request returns cached result; expired token re-executes |

**Acceptance:** All tests pass; ≥ 80% line coverage on `services/` and `utils/`.

### 12.2 Integration Tests

**Location:** `functions/src/tests/integration/` using Firebase Local Emulator Suite

| Test Suite | Scope |
|-----------|-------|
| `BreedingIntegrationTest` | preview → confirm → incubate → hatch lifecycle; verify Firestore state at each step |
| `RespecIntegrationTest` | Free then paid respec; balance and chicken state verified atomically |
| `CooldownEnforcementTest` | Second breed within 72 h → 409 |
| `WeeklyCapTest` | 21st attempt → 409; simulate week reset → attempt succeeds |
| `AdminPromotionTest` | candidate create → review → promote; archetype catalog and registry verified |
| `TradeCapTest` | Transfer trade-locked chicken → 403 |
| `CollisionConcurrencyTest` | 50 concurrent hatch requests same tag → exactly 1 success, 0 data races |

### 12.3 End-to-End Tests

**Location:** `app/src/androidTest/` using Espresso + Compose Test

| Flow | Steps |
|------|-------|
| Breed and Hatch | Login → Map → Inventory → Select chickens → Preview → Confirm → Incubate (skip timer) → Hatch Reveal → Verify in inventory |
| Respec | Inventory → Detail → Skill Tree → Assign nodes → Preview → Confirm → Verify reset + balance |
| Admin Promotion | Admin login → Candidate Dossier → Promote → Verify archetype catalog |

### 12.4 Performance Tests

| Test | Target |
|------|--------|
| Hatch endpoint load test (100 RPS) | P99 ≤ 3 s |
| Breeding preview load (200 RPS) | P95 ≤ 500 ms |
| Collision stress test (1000 concurrent, same tag) | 0 data races; exactly 1 success |
| App cold start benchmark | ≤ 3 s on Pixel 3a equivalent |

**Tools:** k6 for Cloud Functions; Android Benchmark library for app startup.

### 12.5 Security Tests

| Test | Method |
|------|--------|
| Unauthenticated mutation | Call mutation endpoint without auth token → expect 401 |
| Cross-user access | Valid token + another user's chickenId → expect 403 |
| Firestore direct write bypass | Write `genomeSnapshot` via SDK → expect security rule rejection |
| Replay attack | Reuse idempotency token after TTL → expect fresh execution |
| Rate limit bypass | > 60 preview requests in 1 min → expect 429 |

---

## 13. Rollout Plan & Feature Flags

### 13.1 Feature Flags (Firebase Remote Config)

| Flag | Default | Controls |
|------|---------| ---------|
| `feature_breeding_enabled` | false | Entire breeding system |
| `feature_cross_class_breeding` | false | Cross-class composites |
| `feature_mutation_enabled` | false | Ability mutation |
| `feature_archetype_candidate_pipeline` | false | Candidate dossier and promotion |
| `feature_care_minigame` | false | Incubation care actions |
| `feature_admin_tools` | false | Admin screens (plus admin claim) |
| `breeding_weekly_cap` | 20 | Tunable integer |
| `composite_chance_base` | 0.20 | Tunable float |
| `mutation_archetype_pool_chance` | 0.0005 | Tunable float |
| `respec_base_fee` | 2000 | Tunable integer |
| `respec_refund_pct` | 0.50 | Tunable float |

### 13.2 Rollout Stages

| Stage | Audience | Duration | Gates |
|-------|---------|---------|-------|
| Internal Alpha | Team + QA (~20 users) | 2 weeks | All features ON |
| Closed Beta | 500 invited players | 4 weeks | Breeding ON; cross-class OFF |
| Open Beta | All downloads | 4 weeks | Cross-class enabled at 10%; ramp to 100% |
| Launch (v1.0) | General availability | — | All core features ON |

### 13.3 Rollback Procedure

1. Disable relevant feature flag in Firebase Remote Config (propagates in < 60 s).
2. If data corruption: run targeted Firestore migration script (Section 15).
3. Communicate via in-app banner and status page.

---

## 14. CI/CD & Branching/Release Workflow

### 14.1 Branching Strategy (Trunk-Based)

```
main            – protected; requires PR + 1 approval + CI pass
feature/*       – short-lived; merge to main via PR
hotfix/*        – critical fixes; merge to main; cherry-pick to release/* if needed
release/vX.Y.Z  – stabilization; bug fixes only
```

### 14.2 GitHub Actions Workflows

**`ci.yml`** — triggers on every PR to `main`

```yaml
jobs:
  android-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '17' }
      - run: ./gradlew assembleDebug lint test
  functions-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd functions && npm ci && npm run lint && npm test
```

**`deploy-functions.yml`** — triggers on merge to `main`

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
        working-directory: functions
      - uses: google-github-actions/auth@v2
        with: { credentials_json: '${{ secrets.GCP_SA_KEY }}' }
      - run: npx firebase deploy --only functions --project ${{ vars.FIREBASE_PROJECT_ID }}
```

**`release.yml`** — manual trigger; builds release APK

```yaml
on:
  workflow_dispatch:
    inputs: { version_name: { required: true } }
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew assembleRelease
      - uses: actions/upload-artifact@v4
        with: { name: release-apk, path: app/build/outputs/apk/release/*.apk }
```

### 14.3 Release Versioning

- SemVer: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`).
- Android `versionCode` = `MAJOR * 10000 + MINOR * 100 + PATCH`.
- Git tag on each release: `v1.0.0`.

### 14.4 Secrets Management

- Firebase service account key: GitHub Actions secret `GCP_SA_KEY`.
- Firebase project ID: GitHub Actions variable `FIREBASE_PROJECT_ID`.
- Maps API key: `local.properties` (gitignored); injected via secret `MAPS_API_KEY` in CI.
- No secrets in source code or Firestore documents.

---

## 15. Operational Runbooks & Incident Handling

### 15.1 On-Call Rotation

- Primary on-call: rotates weekly among backend engineers.
- Escalation: Product Owner for economy/balance issues; Data Engineer for BigQuery issues.
- Communication: Slack `#cluckymoa-incidents`; PagerDuty for P0/P1.

### 15.2 Incident Severity

| Level | Definition | Response Time |
|-------|-----------| -------------|
| P0 | Service down; no players can hatch or breed | < 15 min |
| P1 | Critical feature broken (balance corruption) | < 1 h |
| P2 | Significant degradation (> 1% error rate) | < 4 h |
| P3 | Minor issue; workaround available | Next business day |

### 15.3 Runbook: Hatch Job Failure Spike

1. Check Cloud Functions logs in Google Cloud Console.
2. If `UNIQUE_MODIFIER_REGISTRY` errors: verify registry collection is not locked; check free tag count.
3. If Firestore transaction contention: check for hot documents; review sharding config.
4. If genome resolution error: examine `breeding_history` for corrupted `genomeSeedBlob`.
5. Mitigation: disable `feature_breeding_enabled` via Remote Config.
6. Fix: deploy corrected Cloud Function version; re-enable flag.
7. Post-mortem within 48 h.

### 15.4 Runbook: Balance Anomaly (Win Rate > 65%)

1. Identify archetype via Looker Studio "Balance & Fairness" dashboard.
2. Pull stat/ability distribution of affected archetype instances from BigQuery.
3. If hatch-algorithm bug: disable `feature_cross_class_breeding` if related; deploy patch.
4. If tuning issue: adjust archetype parameter bounds in `archetype_catalog`; publish patch notes.
5. If patch nerfs live chickens: offer respec token override to affected players.

### 15.5 Runbook: Economy Imbalance (Refunds > Fees)

1. Pull daily respec economics from BigQuery.
2. Check distribution of `trainingValueSpent` on respec'd chickens.
3. If exploitation detected: adjust `respec_refund_pct` via Remote Config.
4. Announce change in-app 3 days before effect.

### 15.6 Runbook: Unique Modifier Exhaustion

1. Monitor `unique_modifier_registry` free tag count. Alert when < 10,000.
2. Expand mutation pool and designer-authored tag list.
3. Deploy new tags via admin bulk-add tool.

### 15.7 Data Migration Procedure

1. Write idempotent migration script in `functions/src/migrations/vN_description.ts`.
2. Track completion in `migrations/{version}` Firestore document.
3. Test on Local Emulator with production-shaped snapshot.
4. Deploy in off-peak maintenance window.
5. Verify via migration document status and spot-check sample documents.
6. Increment `schemaVersion` on affected documents.

---

## 16. Implementation Phases with Acceptance Criteria & DoD

### Definition of Done — applies to every item

- Code reviewed and approved (≥ 1 engineer).
- Unit tests passing; ≥ 80% coverage on changed code.
- Integration tests passing on emulator.
- No lint errors.
- Feature flag wiring in place.
- Telemetry events firing (verified in DebugView).
- Accessibility: content descriptions and contrast verified.
- Documentation updated in this file if design changed.

---

### Phase 1 — Core Infrastructure (Sprint 1–3)

**Goal:** Deployable skeleton with auth, area data, archetype catalog, and unique modifier registry.

| Item | Acceptance Criteria |
|------|-------------------|
| Firebase project setup (Auth, Firestore, Functions, Storage, Analytics) | CI deploys functions; Firestore rules block unauthenticated writes |
| Android skeleton (Hilt, Compose, Navigation) | App launches to Login; Google Sign-In succeeds; navigates to placeholder Map |
| `players/{userId}` created on first login | Document created: default coinBalance=0, incubatorSlots=1 |
| `archetype_catalog` seeded (12 archetypes) | All 12 returned by admin query; each has paramBounds and statBounds |
| Area data seeded (Oʻahu pilot, 3 districts) | ≥ 30 unique breedIds across 3 areas |
| `unique_modifier_registry` bulk-load tool | 10,000 designer-authored tags loaded; all `assigned: false` |
| UniqueModifierRegistry Cloud Function | Collision concurrency test (50 concurrent) passes |

---

### Phase 2 — Chicken Capture & Progression (Sprint 4–6)

| Item | Acceptance Criteria |
|------|-------------------|
| Map screen with spawn markers | Markers within area boundary; tap opens encounter sheet |
| Capture flow | Chicken document created: correct class, breedId, nativeAreaId, uniqueModifierTag |
| Chicken inventory screen | All owned chickens listed; class and rarity filters work |
| Chicken detail screen | Stats, abilities, uniqueModifierTag displayed |
| Skill tree with node assignment | Nodes assign; unspentSkillPoints decrements; anti-synergy blacklist enforced |
| Respec preview and confirm | Free respec on first use; paid respec math correct; balance changes atomically; history written |
| XP and leveling | Encounters grant XP; level-up grants skill point |
| Training item application | tome increments trainingValueSpent by canonical value; weekly cap enforced |

---

### Phase 3 — Breeding MVP (Sprint 7–9)

| Item | Acceptance Criteria |
|------|-------------------|
| Breed parent select + preview screens | Probabilities sum to 1.0; cost shown correctly |
| `POST /api/breeding/confirm` | Egg created; parent cooldowns set; cost deducted; history written |
| Incubator screen with countdown | EggCard shows correct countdown; "Hatch!" appears at expiry |
| `POST /api/eggs/{id}/hatch` | Deterministic: same seed → same chicken; uniqueModifierTag allocated atomically |
| Hatch reveal screen | Animation plays; class badge; pedigree card; inheritance breakdown |
| Pure-class breeding | All offspring primaryClass matches one parent; no secondaryTraits |
| Idempotency on breed confirm + hatch | Duplicate request within 10 min returns same result |
| Parent cooldown + lifetime cap | Second breed in < 72 h → 409; 9th breed attempt → 409 |
| Weekly cap | 21st attempt → 409; resets Monday |

---

### Phase 4 — Cross-Class & Composites (Sprint 10–11)

| Item | Acceptance Criteria |
|------|-------------------|
| Enable `feature_cross_class_breeding` | Composites produced at ~20% rate (±5% over 1000 hatches) |
| Secondary trait resolution | Traits drawn from correct class pool; magnitudes within bounds |
| Ability blending | Blended abilities use correct template family; params within bounds |
| Ability mutation | 3% mutation rate confirmed over 1000 hatches; novel modifier from pool |
| Hatch reveal shows composite indicator | secondaryTraits listed; composite badge shown |
| Anti-synergy blacklist enforced | Forbidden combos never appear in hatch output |

---

### Phase 5 — Archetype Candidate Pipeline (Sprint 12–13)

| Item | Acceptance Criteria |
|------|-------------------|
| Enable `feature_archetype_candidate_pipeline` | Candidate dossier created when eligible hatch occurs |
| Telemetry aggregator job | Dossier `telemetrySummary` fields populated within 24 h |
| Admin candidate dossier screen | List renders; actions update `reviewStatus`; audit log written |
| Promote archetype flow | `POST /admin/promoteCandidate` creates catalog entry; registry updated; badge granted |
| Trade lock on candidates | `tradeLockUntil` enforced by Firestore rules for 7 days |
| Staged rollback | Setting spawn weight to 0 removes from wild spawns without deleting player instances |

---

### Phase 6 — Polish, Events & Launch Prep (Sprint 14–16)

| Item | Acceptance Criteria |
|------|-------------------|
| Care mini-game | Timing validated server-side; < 200 ms rejected; modifier applies |
| Consumable system | Consumables adjust probabilities within bounds; rate limits enforced |
| Full Oʻahu launch (6+ districts) | ≥ 10 unique breeds per district; GPS boundary accurate |
| All islands seeded | 6 islands × ≥ 10 breeds/district; ≥ 180 unique breeds at launch |
| Performance pass | Hatch P99 ≤ 3 s; cold start ≤ 3 s |
| Security review | All security tests pass; App Check enforced in production |
| Accessibility audit | All screens pass TalkBack; contrast ratios verified |
| Looker Studio dashboards live | All 5 dashboards operational; alert thresholds configured |
| Remote Config wired | All feature flags verifiable via Remote Config console |

---

## 17. Risks, Mitigations & Open Decision Defaults

| Risk | Likelihood | Impact | Mitigation | Default |
|------|-----------|--------|-----------|---------|
| Unique modifier exhaustion | Medium | High | Pre-generate 500K tags; monitor free count | 500K tags pre-generated |
| Firestore hot-document contention on registry | Medium | Medium | Shard by tag prefix (26 shards); use transactions | Sharding: enabled Phase 3 |
| Cross-class balance runaway | Medium | High | Hard stat caps + anti-synergy blacklist + weekly balance review | Caps at archetype bounds |
| Breeding bot abuse | High | Medium | App Check + anomaly detection + rate limits | Flag threshold: 10/h |
| Respec fee economy imbalance | Low | Medium | Tunable `respec_refund_pct` via Remote Config | Default 50% |
| Too many archetype candidates | Low | Low | 0.05% chance + 7-day review window | 7-day mandatory window |
| Google Maps billing overrun | Medium | Medium | Client-side tile caching; limit refresh rate | Max refresh: 1 per 30 s |
| Player backlash on respec fee | Medium | Low | Clear in-app preview; first respec free | First respec always free |
| iOS demand without client | High | Medium | Backend is platform-agnostic; iOS added v1.1 | iOS: v1.1 |

**Open Decisions — resolved with defaults:**
- Should hybrid visuals be fully procedurally generated? **Default: YES** — artists supply modular parts; engine blends. Bespoke art only for promoted archetypes.
- Should trade be open immediately after lock expires? **Default: YES** — no additional verification.
- Should consumables be earnable only in-game? **Default: BOTH** — earnable via gameplay and purchasable in shop; permanent upgrade consumables via events only.
- Should the fee escalate per paid respec? **Default: YES** — +500 coins per `respecPaidCount`.

---

## 18. Agent Execution Instructions

Execute phases in order. Do not skip phases. Complete all DoD items for a phase before starting the next.

### Step 1 — Repository & Project Setup
1. Ensure `settings.gradle.kts`: `rootProject.name = "CluckyMoa"`.
2. Configure `app/build.gradle.kts`: `minSdk 26`, `compileSdk 35`, Kotlin 1.9+, Compose BOM latest stable.
3. Add dependencies: Firebase BoM, Google Maps Compose, Hilt, Retrofit, Coil, Coroutines.
4. Run `firebase init` in `backend/` selecting: Firestore, Functions (TypeScript), Storage, Analytics.
5. Add `google-services.json` to `app/` (gitignored).
6. Extend `.gitignore`: `google-services.json`, `local.properties`, `node_modules/`, `functions/lib/`, `.env`.

### Step 2 — Firestore Security Rules & Indexes
1. Implement `firestore.rules`:
   - `players/{userId}`: owner read/write.
   - `chickens/{chickenId}`: owner read; functions-only write for game-state fields; `genomeSnapshot` is write-once.
   - `eggs/{eggId}`: owner read; no client writes.
   - `unique_modifier_registry/*`: client read-only; functions-only write.
   - Admin collections require `admin` custom claim.
2. Create `firestore.indexes.json`: composite index on `chickens` (ownerId + rarity), (ownerId + primaryClass); `eggs` (ownerId + status).

### Step 3 — Cloud Functions Scaffold
1. Create `functions/src/index.ts` registering all callable functions.
2. Implement middleware: `auth.ts`, `rateLimit.ts`, `idempotency.ts`, `appCheck.ts`.
3. Implement `UniqueModifierRegistry.ts` with `allocate()` (Section 9.6 pseudocode).
4. Implement `deterministicRng.ts` (Xoshiro256** seeded PRNG).
5. Implement `genomeResolver.ts`, `classResolver.ts`, `abilityBlender.ts` (Section 9 pseudocode).

### Step 4 — Data Seeding
1. Write seed script `functions/src/seeds/archetypes.ts` populating 12 archetypes per Section 5.8 schema.
2. Write seed script for Oʻahu pilot areas (3 districts, ≥ 10 breeds each) per Section 5.9 schema.
3. Write bulk-load script for 10,000 designer-authored `unique_modifier_registry` tags.
4. Run seeds against emulator; verify with integration tests.

### Step 5 — Core Services Implementation (Phase 1 + 2 items)
1. Implement `BreedingService.ts` (preview + confirm).
2. Implement `HatchService.ts` (hatch + idempotency).
3. Implement `RespecService.ts` (preview + confirm).
4. Implement `SpawnService.ts` (area spawns + capture).
5. Implement `EconomyService.ts` (debit/credit).
6. Write unit tests for each service (Section 12.1).
7. Run integration tests against emulator (Section 12.2).

### Step 6 — Android App Skeleton (Phase 1 + 2 screens)
1. Implement LoginScreen with Google Sign-In.
2. Implement MapScreen (maps + spawn markers + area overlay).
3. Implement InventoryScreen + ChickenDetailScreen.
4. Implement SkillTreeScreen + RespecFlow.
5. Wire all screens to ViewModels and Firebase SDK data sources.
6. Run Compose tests for each screen.

### Step 7 — Breeding UI (Phase 3 screens)
1. Implement BreedingParentSelectScreen, BreedPreviewScreen, BreedConfirmScreen.
2. Implement IncubatorScreen + EggCard + TimerBadge.
3. Implement HatchRevealScreen + PedigreeScreen.
4. Run E2E test: Breed and Hatch flow (Section 12.3).

### Step 8 — Cross-Class & Composites (Phase 4)
1. Enable `feature_cross_class_breeding` in test environment.
2. Enable `feature_mutation_enabled`.
3. Run 1000-hatch simulation tests; verify composite rate and mutation rate.
4. Verify anti-synergy blacklist enforcement.

### Step 9 — Archetype Candidate Pipeline (Phase 5)
1. Implement `TelemetryService.ts` aggregation job.
2. Implement `ArchetypePromotionService.ts`.
3. Implement admin screens: CandidateDossierScreen, PromoteArchetypeScreen.
4. Run admin promotion E2E test.

### Step 10 — Polish & Launch Prep (Phase 6)
1. Implement CareMinigameScreen + server-side timing validation.
2. Implement consumable system (Selective Serum, Fertility Tonic, Accelerants).
3. Seed all 6 islands.
4. Run performance tests (Section 12.4).
5. Run security tests (Section 12.5).
6. Run accessibility audit.
7. Configure Looker Studio dashboards and alert thresholds.
8. Enable all production feature flags; verify Remote Config.

### Step 11 — CI/CD & Deployment
1. Implement GitHub Actions workflows per Section 14.2 (`ci.yml`, `deploy-functions.yml`, `release.yml`).
2. Add GitHub Secrets: `GCP_SA_KEY`, `MAPS_API_KEY`.
3. Add GitHub Variables: `FIREBASE_PROJECT_ID`.
4. Verify CI passes on a test PR.
5. Deploy functions to production environment.
6. Tag release `v1.0.0`.

---

## 19. Signed Decisions Reference

| Decision | Choice | Notes |
|----------|--------|-------|
| Classes | Air, Ground, Ocean | Gameplay-affecting |
| Islands included | Kauaʻi, Oʻahu, Maui, Molokaʻi, Lānaʻi, Hawaiʻi | Niʻihau + Kahoʻolawe excluded |
| Breeds per area | ≥ 10 unique | Unique primary+ultimate signature each |
| Area obtainability | Native area only | Global usability once owned |
| Ability model | Hybrid (energy pool + cooldown) | Primary + ultimate per chicken |
| Ability slots | 1 primary + 1 ultimate | No secondary active slot |
| Upgrade model | Skill tree + consumable augments | Permanent augments via events only |
| Respec policy | First free; subsequent Refund + Fee | Full-tree reset only |
| Cross-class breeding | Fully allowed | Composite chance 20% base |
| Hybrid archetypes | Allowed via curated promotion pipeline | 0.05% candidate chance; human review required |
| Data storage | Firebase Firestore (no SQLite) | Cloud-native; no local persistence of game state |

---

*(End of document — v2.0)*
