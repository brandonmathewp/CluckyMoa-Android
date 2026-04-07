"use strict";

// ── Game Constants ──────────────────────────────────────────────────────────

// Progression
const LEVEL_CAP = 50;
const SKILL_POINTS_PER_LEVEL = 1;

// Respec
const RESPEC_BASE_FEE = 2000; // coins
const RESPEC_REFUND_PCT = 0.5; // 50 %

// Training item canonical values (coins)
const TRAINING_VALUES = {
  common: 1000,
  uncommon: 1800,
  rare: 3000,
  epic: 8000,
};

// Weekly caps
const WEEKLY_TRAINING_SP_CAP = 10; // skill points / week / account
const WEEKLY_BREED_CAP = 20; // breed attempts / week / account

// Breeding
const PARENT_COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 h in ms
const PARENT_LIFETIME_BREED_CAP = 8;
const COMPOSITE_BASE_CHANCE = 0.20;
const MUTATION_CHANCE = 0.0005; // ~0.05 %
const BLEND_CHANCE = 0.15;

// Egg incubation (seconds)
const INCUBATION_SECONDS = {
  common: 12 * 3600,
  uncommon: 24 * 3600,
  rare: 48 * 3600,
  legendary: 96 * 3600,
};

// Breed costs (coins)
const BREED_COSTS = {
  common: 1000,
  uncommon: 2000,
  rare: 5000,
  legendary: 15000,
};

// uniqueModifier allocation max attempts
const UNIQUE_TAG_MAX_ATTEMPTS = 3;

// Archetype candidate mutation threshold
const ARCHETYPE_CANDIDATE_CHANCE = 0.0005;

module.exports = {
  LEVEL_CAP,
  SKILL_POINTS_PER_LEVEL,
  RESPEC_BASE_FEE,
  RESPEC_REFUND_PCT,
  TRAINING_VALUES,
  WEEKLY_TRAINING_SP_CAP,
  WEEKLY_BREED_CAP,
  PARENT_COOLDOWN_MS,
  PARENT_LIFETIME_BREED_CAP,
  COMPOSITE_BASE_CHANCE,
  MUTATION_CHANCE,
  BLEND_CHANCE,
  INCUBATION_SECONDS,
  BREED_COSTS,
  UNIQUE_TAG_MAX_ATTEMPTS,
  ARCHETYPE_CANDIDATE_CHANCE,
};
