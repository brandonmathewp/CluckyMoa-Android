"use strict";

const { setGlobalOptions } = require("firebase-functions");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");

const { db, admin } = require("./config/firebaseAdmin");
const {
  RESPEC_BASE_FEE,
  RESPEC_REFUND_PCT,
  INCUBATION_SECONDS,
  BREED_COSTS,
  COMPOSITE_BASE_CHANCE,
  ARCHETYPE_CANDIDATE_CHANCE,
  BLEND_CHANCE,
  PARENT_COOLDOWN_MS,
  PARENT_LIFETIME_BREED_CAP,
  WEEKLY_BREED_CAP,
  WEEKLY_TRAINING_SP_CAP,
  UNIQUE_TAG_MAX_ATTEMPTS,
  TRAINING_VALUES,
} = require("./config/constants");
const { BREEDS } = require("./config/breedData");
const { validateIdempotencyToken } = require("./utils/idempotency");
const { createSeededRng, weightedPick } = require("./utils/rng");
const { requireAuth, requireFields, requireAdmin } = require("./utils/validation");
const { sendDiscordNotification } = require("./utils/discord");

setGlobalOptions({ maxInstances: 10 });

// ── Helpers ────────────────────────────────────────────────────────────────

function nowMs() {
  return Date.now();
}

function weekKey(ts) {
  const d = new Date(ts);
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function httpError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const MILLIS_PER_HOUR = 3600 * 1000;

function getDiscordWebhookUrl() {
  return process.env.DISCORD_WEBHOOK_URL || null;
}

function rarityWeight(rarity) {
  return { common: 1, uncommon: 2, rare: 4, legendary: 8 }[rarity] || 1;
}

function computeEggRarity(parentA, parentB) {
  const w = rarityWeight(parentA.rarity) + rarityWeight(parentB.rarity);
  if (w >= 12) return { common: 0.1, uncommon: 0.3, rare: 0.45, legendary: 0.15 };
  if (w >= 8) return { common: 0.25, uncommon: 0.4, rare: 0.3, legendary: 0.05 };
  if (w >= 4) return { common: 0.45, uncommon: 0.35, rare: 0.18, legendary: 0.02 };
  return { common: 0.65, uncommon: 0.28, rare: 0.06, legendary: 0.01 };
}

function computeCompositeChance(parentA, parentB) {
  let chance = COMPOSITE_BASE_CHANCE;
  if (parentA.rarity === "rare" || parentB.rarity === "rare") chance += 0.05;
  if (parentA.rarity === "legendary" || parentB.rarity === "legendary") chance += 0.1;
  return Math.min(chance, 0.5);
}

function computeClassProbabilities(parentA, parentB, compositeChance) {
  const sameClass = parentA.primaryClass === parentB.primaryClass;
  if (sameClass) {
    return { [parentA.primaryClass]: 1 - compositeChance, composite: compositeChance };
  }
  const half = (1 - compositeChance) / 2;
  return {
    [parentA.primaryClass]: half + 0.05,
    [parentB.primaryClass]: half - 0.05,
    composite: compositeChance,
  };
}

// ── 1. Chicken Management ──────────────────────────────────────────────────

exports.getChicken = onCall(async(request) => {
  const uid = requireAuth(request);
  const { chickenId } = request.data;
  if (!chickenId) throw httpError("invalid-argument", "chickenId required");

  const snap = await db.collection("chickens").doc(chickenId).get();
  if (!snap.exists) throw httpError("not-found", "Chicken not found");
  const chicken = snap.data();
  if (chicken.ownerId !== uid) throw httpError("permission-denied", "Not your chicken");
  return { chickenId: snap.id, ...chicken };
});

exports.getOwnedChickens = onCall(async(request) => {
  const uid = requireAuth(request);
  const snap = await db.collection("chickens").where("ownerId", "==", uid).get();
  return snap.docs.map((d) => ({ chickenId: d.id, ...d.data() }));
});

exports.updateChickenName = onCall(async(request) => {
  const uid = requireAuth(request);
  requireFields(request.data, ["chickenId", "name"]);
  const { chickenId, name } = request.data;
  if (name.trim().length === 0 || name.length > 40) {
    throw httpError("invalid-argument", "Invalid name");
  }
  const ref = db.collection("chickens").doc(chickenId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError("not-found", "Chicken not found");
  if (snap.data().ownerId !== uid) throw httpError("permission-denied", "Not your chicken");
  await ref.update({ name: name.trim() });
  return { success: true };
});

// ── 2. Respec System ───────────────────────────────────────────────────────

exports.getRespecPreview = onCall(async(request) => {
  const uid = requireAuth(request);
  const { chickenId } = request.data;
  if (!chickenId) throw httpError("invalid-argument", "chickenId required");

  const snap = await db.collection("chickens").doc(chickenId).get();
  if (!snap.exists) throw httpError("not-found", "Chicken not found");
  const c = snap.data();
  if (c.ownerId !== uid) throw httpError("permission-denied", "Not your chicken");

  const free = !c.freeRespecUsed;
  // eslint-disable-next-line camelcase
  const training_value_spent = c.training_value_spent || 0;
  // eslint-disable-next-line camelcase
  const refundAmount = free ? 0 : Math.floor(training_value_spent * RESPEC_REFUND_PCT);
  const fee = free ? 0 : RESPEC_BASE_FEE;
  const net = refundAmount - fee;
  const balanceRequired = free ? 0 : fee;

  return { free, training_value_spent, refundAmount, fee, net, balanceRequired }; // eslint-disable-line camelcase
});

exports.confirmRespec = onCall(async(request) => {
  const uid = requireAuth(request);
  await checkBan(uid);
  requireFields(request.data, ["chickenId", "idempotencyToken"]);
  const { chickenId, idempotencyToken } = request.data;

  await validateIdempotencyToken(uid, idempotencyToken);

  const chickenRef = db.collection("chickens").doc(chickenId);
  const userRef = db.collection("users").doc(uid);

  let result;
  await db.runTransaction(async(tx) => {
    const cSnap = await tx.get(chickenRef);
    const uSnap = await tx.get(userRef);
    if (!cSnap.exists) throw httpError("not-found", "Chicken not found");
    const c = cSnap.data();
    if (c.ownerId !== uid) throw httpError("permission-denied", "Not your chicken");

    const balance = (uSnap.exists && uSnap.data().balance) || 0;
    const free = !c.freeRespecUsed;
    // eslint-disable-next-line camelcase
    const training_value_spent = c.training_value_spent || 0;
    // eslint-disable-next-line camelcase
    const refundAmount = free ? 0 : Math.floor(training_value_spent * RESPEC_REFUND_PCT);
    const fee = free ? 0 : RESPEC_BASE_FEE;
    const net = refundAmount - fee;

    if (!free && balance < fee) {
      throw httpError("failed-precondition", "Insufficient balance");
    }

    const levelPoints = (c.level || 1) - 1;
    const milestonePoints = c.milestoneSkillPoints || 0;
    const lineageBonus = c.lineageBonusPoints || 0;
    const trainingPoints = c.trainingSkillPointsTotal || 0;
    const newUnspent = levelPoints + milestonePoints + lineageBonus + trainingPoints;

    const chickenUpdate = {
      assignedNodes: {},
      unspentSkillPoints: newUnspent,
      training_value_spent: 0,
    };

    if (free) {
      chickenUpdate.freeRespecUsed = true;
    } else {
      chickenUpdate.respecPaidCount = admin.firestore.FieldValue.increment(1);
    }

    tx.update(chickenRef, chickenUpdate);

    if (!free) {
      const newBal = balance - fee + Math.max(0, net);
      tx.set(userRef, { balance: newBal }, { merge: true });
    }

    const historyRef = db.collection("respec_history").doc();
    tx.set(historyRef, {
      chickenId,
      actorUserId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      free,
      feeCharged: free ? 0 : fee,
      refundGiven: free ? 0 : Math.max(0, net),
      training_value_spent_before: training_value_spent, // eslint-disable-line camelcase
      notes: "",
    });

    const uBalance = (uSnap.exists && uSnap.data().balance) || 0;
    const newBalance = free ?
      uBalance :
      Math.max(0, uBalance - fee + Math.max(0, net));

    result = {
      result: "success",
      feeCharged: free ? 0 : fee,
      refundGiven: free ? 0 : Math.max(0, net),
      newBalance,
      respecHistoryId: historyRef.id,
    };
  });

  return result;
});

// ── 3. Skill Tree ──────────────────────────────────────────────────────────

const VALID_SKILL_NODES = new Set([
  "primary_dmg_1", "primary_dmg_2", "primary_dmg_3", "primary_dmg_4", "primary_dmg_5",
  "primary_cost_1", "primary_cost_2",
  "primary_cd_1", "primary_cd_2",
  "primary_fx_1",
  "ult_tier1", "ult_tier2", "ult_tier3",
  "stat_hp_1", "stat_hp_2",
  "stat_armor_1", "stat_armor_2",
  "stat_speed_1", "stat_energy_1", "stat_regen_1",
]);

const NODE_PREREQUISITES = {
  "primary_dmg_2": "primary_dmg_1",
  "primary_dmg_3": "primary_dmg_2",
  "primary_dmg_4": "primary_dmg_3",
  "primary_dmg_5": "primary_dmg_4",
  "primary_cost_2": "primary_cost_1",
  "primary_cd_2": "primary_cd_1",
  "ult_tier2": "ult_tier1",
  "ult_tier3": "ult_tier2",
  "stat_hp_2": "stat_hp_1",
  "stat_armor_2": "stat_armor_1",
};

exports.assignSkillNode = onCall(async(request) => {
  const uid = requireAuth(request);
  await checkBan(uid);
  requireFields(request.data, ["chickenId", "nodeId"]);
  const { chickenId, nodeId } = request.data;

  if (!VALID_SKILL_NODES.has(nodeId)) {
    throw httpError("invalid-argument", "Invalid skill node");
  }

  const ref = db.collection("chickens").doc(chickenId);
  await db.runTransaction(async(tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError("not-found", "Chicken not found");
    const c = snap.data();
    if (c.ownerId !== uid) throw httpError("permission-denied", "Not your chicken");
    if ((c.unspentSkillPoints || 0) < 1) throw httpError("failed-precondition", "No skill points");

    const assigned = c.assignedNodes || {};
    if (assigned[nodeId]) throw httpError("already-exists", "Node already assigned");

    const prereq = NODE_PREREQUISITES[nodeId];
    if (prereq && !assigned[prereq]) {
      throw httpError("failed-precondition", `Prerequisite not met: ${prereq}`);
    }

    tx.update(ref, {
      [`assignedNodes.${nodeId}`]: true,
      unspentSkillPoints: admin.firestore.FieldValue.increment(-1),
    });
  });

  return { success: true };
});

exports.applyTrainingItem = onCall(async(request) => {
  const uid = requireAuth(request);
  await checkBan(uid);
  requireFields(request.data, ["chickenId", "itemTier"]);
  const { chickenId, itemTier } = request.data;

  const tierMap = {
    common: { sp: 1, value: TRAINING_VALUES.common },
    uncommon: { sp: 1, value: TRAINING_VALUES.uncommon },
    rare: { sp: 3, value: TRAINING_VALUES.rare },
    epic: { sp: 5, value: TRAINING_VALUES.epic },
  };

  const item = tierMap[itemTier];
  if (!item) throw httpError("invalid-argument", "Invalid item tier");

  const userRef = db.collection("users").doc(uid);
  const chickenRef = db.collection("chickens").doc(chickenId);
  const week = weekKey(nowMs());

  await db.runTransaction(async(tx) => {
    const [uSnap, cSnap] = await Promise.all([tx.get(userRef), tx.get(chickenRef)]);
    if (!cSnap.exists) throw httpError("not-found", "Chicken not found");
    const c = cSnap.data();
    if (c.ownerId !== uid) throw httpError("permission-denied", "Not your chicken");

    const uData = uSnap.exists ? uSnap.data() : {};
    const weeklyTraining = (uData.weeklyTraining && uData.weeklyTraining[week]) || 0;
    if (weeklyTraining + item.sp > WEEKLY_TRAINING_SP_CAP) {
      throw httpError("resource-exhausted", "Weekly training cap reached");
    }

    tx.update(chickenRef, {
      training_value_spent: admin.firestore.FieldValue.increment(item.value),
      unspentSkillPoints: admin.firestore.FieldValue.increment(item.sp),
      trainingSkillPointsTotal: admin.firestore.FieldValue.increment(item.sp),
    });

    tx.set(userRef, {
      weeklyTraining: { [week]: weeklyTraining + item.sp },
    }, { merge: true });
  });

  return { success: true };
});

// ── 4. Breeding System ─────────────────────────────────────────────────────

exports.breedingPreview = onCall(async(request) => {
  const uid = requireAuth(request);
  requireFields(request.data, ["parentAId", "parentBId"]);
  const { parentAId, parentBId } = request.data;

  const [snapA, snapB] = await Promise.all([
    db.collection("chickens").doc(parentAId).get(),
    db.collection("chickens").doc(parentBId).get(),
  ]);

  if (!snapA.exists || !snapB.exists) throw httpError("not-found", "Parent not found");
  const pA = snapA.data();
  const pB = snapB.data();
  if (pA.ownerId !== uid || pB.ownerId !== uid) {
    throw httpError("permission-denied", "Not your chickens");
  }

  const compositeChance = computeCompositeChance(pA, pB);
  const classProbabilities = computeClassProbabilities(pA, pB, compositeChance);
  const eggRarity = computeEggRarity(pA, pB);

  const rng = createSeededRng(`${parentAId}_${parentBId}_preview`);
  const dominantRarity = weightedPick(eggRarity, rng);
  const cost = BREED_COSTS[dominantRarity] || BREED_COSTS.common;
  const incubationSeconds = INCUBATION_SECONDS[dominantRarity] || INCUBATION_SECONDS.common;

  const previewSeedHash = crypto
      .createHash("sha256")
      .update(`${parentAId}${parentBId}${nowMs()}`)
      .digest("hex");

  return {
    classProbabilities,
    compositeChance,
    mutationChance: ARCHETYPE_CANDIDATE_CHANCE,
    abilityOrigin: {
      primary: { A: 0.5, B: 0.35, blend: BLEND_CHANCE },
      ultimate: { A: 0.5, B: 0.35, blend: BLEND_CHANCE },
    },
    eggRarity,
    cost: { coins: cost, total: cost },
    incubationSeconds,
    previewSeedHash,
  };
});

exports.breedingConfirm = onCall(async(request) => {
  const uid = requireAuth(request);
  await checkBan(uid);
  requireFields(request.data, ["parentAId", "parentBId", "idempotencyToken"]);
  const { parentAId, parentBId, consumables = [], idempotencyToken } = request.data;

  await validateIdempotencyToken(uid, idempotencyToken);

  const chickenARef = db.collection("chickens").doc(parentAId);
  const chickenBRef = db.collection("chickens").doc(parentBId);
  const userRef = db.collection("users").doc(uid);
  const week = weekKey(nowMs());

  let result;
  await db.runTransaction(async(tx) => {
    const [snapA, snapB, uSnap] = await Promise.all([
      tx.get(chickenARef),
      tx.get(chickenBRef),
      tx.get(userRef),
    ]);

    if (!snapA.exists || !snapB.exists) throw httpError("not-found", "Parent not found");
    const pA = snapA.data();
    const pB = snapB.data();

    if (pA.ownerId !== uid || pB.ownerId !== uid) {
      throw httpError("permission-denied", "Not your chickens");
    }

    const now = nowMs();
    if (pA.lastBreedAt && (now - pA.lastBreedAt.toMillis()) < PARENT_COOLDOWN_MS) {
      throw httpError("failed-precondition", "Parent A is on cooldown");
    }
    if (pB.lastBreedAt && (now - pB.lastBreedAt.toMillis()) < PARENT_COOLDOWN_MS) {
      throw httpError("failed-precondition", "Parent B is on cooldown");
    }
    if ((pA.breedCount || 0) >= PARENT_LIFETIME_BREED_CAP) {
      throw httpError("failed-precondition", "Parent A has reached lifetime breed cap");
    }
    if ((pB.breedCount || 0) >= PARENT_LIFETIME_BREED_CAP) {
      throw httpError("failed-precondition", "Parent B has reached lifetime breed cap");
    }

    const uData = uSnap.exists ? uSnap.data() : {};
    const weeklyBreed = (uData.weeklyBreed && uData.weeklyBreed[week]) || 0;
    if (weeklyBreed >= WEEKLY_BREED_CAP) {
      throw httpError("resource-exhausted", "Weekly breeding cap reached");
    }

    const eggRarityDist = computeEggRarity(pA, pB);
    const rng = createSeededRng(`${parentAId}${parentBId}${now}`);
    const eggRarity = weightedPick(eggRarityDist, rng);
    const cost = BREED_COSTS[eggRarity] || BREED_COSTS.common;

    const balance = uData.balance || 0;
    if (balance < cost) throw httpError("failed-precondition", "Insufficient balance");

    const incubationSeconds = INCUBATION_SECONDS[eggRarity] || INCUBATION_SECONDS.common;
    const incubationEndsAt = new Date(now + incubationSeconds * 1000);

    const genomeSeedBlob = {
      seed: `${parentAId}_${parentBId}_${now}`,
      parentAClass: pA.primaryClass,
      parentBClass: pB.primaryClass,
      parentARarity: pA.rarity,
      parentBRarity: pB.rarity,
      compositeChance: computeCompositeChance(pA, pB),
      consumables,
    };

    const eggRef = db.collection("eggs").doc();
    tx.set(eggRef, {
      ownerId: uid,
      parentAId,
      parentBId,
      rarity: eggRarity,
      incubationEndsAt: admin.firestore.Timestamp.fromDate(incubationEndsAt),
      genomeSeedBlob,
      careModifiers: {},
      status: "incubating",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.update(chickenARef, {
      breedCount: admin.firestore.FieldValue.increment(1),
      lastBreedAt: admin.firestore.Timestamp.fromMillis(now),
    });
    tx.update(chickenBRef, {
      breedCount: admin.firestore.FieldValue.increment(1),
      lastBreedAt: admin.firestore.Timestamp.fromMillis(now),
    });

    tx.set(userRef, {
      balance: balance - cost,
      weeklyBreed: { [week]: weeklyBreed + 1 },
    }, { merge: true });

    const histRef = db.collection("breeding_history").doc();
    tx.set(histRef, {
      actorId: uid,
      parentAId,
      parentBId,
      eggId: eggRef.id,
      costPaid: cost,
      consumablesUsed: consumables,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    result = {
      eggId: eggRef.id,
      incubationEndsAt: incubationEndsAt.toISOString(),
      message: "Egg created successfully",
    };
  });

  return result;
});

// ── 5. Egg Management ──────────────────────────────────────────────────────

exports.getEgg = onCall(async(request) => {
  const uid = requireAuth(request);
  const { eggId } = request.data;
  if (!eggId) throw httpError("invalid-argument", "eggId required");

  const snap = await db.collection("eggs").doc(eggId).get();
  if (!snap.exists) throw httpError("not-found", "Egg not found");
  const egg = snap.data();
  if (egg.ownerId !== uid) throw httpError("permission-denied", "Not your egg");
  return { eggId: snap.id, ...egg };
});

exports.getOwnedEggs = onCall(async(request) => {
  const uid = requireAuth(request);
  const snap = await db.collection("eggs").where("ownerId", "==", uid).get();
  return snap.docs.map((d) => ({ eggId: d.id, ...d.data() }));
});

exports.accelerateEgg = onCall(async(request) => {
  const uid = requireAuth(request);
  requireFields(request.data, ["eggId", "accelerationSeconds"]);
  const { eggId, accelerationSeconds } = request.data;

  if (accelerationSeconds <= 0 || accelerationSeconds > 86400) {
    throw httpError("invalid-argument", "Invalid acceleration value");
  }

  const eggRef = db.collection("eggs").doc(eggId);
  await db.runTransaction(async(tx) => {
    const snap = await tx.get(eggRef);
    if (!snap.exists) throw httpError("not-found", "Egg not found");
    const egg = snap.data();
    if (egg.ownerId !== uid) throw httpError("permission-denied", "Not your egg");
    if (egg.status !== "incubating") throw httpError("failed-precondition", "Egg not incubating");

    const currentEnd = egg.incubationEndsAt.toMillis();
    const newEnd = Math.max(nowMs(), currentEnd - accelerationSeconds * 1000);
    tx.update(eggRef, {
      incubationEndsAt: admin.firestore.Timestamp.fromMillis(newEnd),
    });
  });

  return { success: true };
});

exports.careAction = onCall(async(request) => {
  const uid = requireAuth(request);
  requireFields(request.data, ["eggId", "actionType"]);
  const { eggId, actionType } = request.data;

  const validActions = ["nurture", "warm", "sing"];
  if (!validActions.includes(actionType)) {
    throw httpError("invalid-argument", "Invalid care action");
  }

  const eggRef = db.collection("eggs").doc(eggId);
  await db.runTransaction(async(tx) => {
    const snap = await tx.get(eggRef);
    if (!snap.exists) throw httpError("not-found", "Egg not found");
    const egg = snap.data();
    if (egg.ownerId !== uid) throw httpError("permission-denied", "Not your egg");
    if (egg.status !== "incubating") throw httpError("failed-precondition", "Egg not incubating");

    const modifiers = egg.careModifiers || {};
    modifiers[actionType] = (modifiers[actionType] || 0) + 0.01;
    tx.update(eggRef, { careModifiers: modifiers });
  });

  return { success: true };
});

// ── 6. Hatching ────────────────────────────────────────────────────────────

const CLASS_TRAIT_POOL = {
  Air: ["glideAffinity", "windResist"],
  Ocean: ["swimAffinity", "waterBreathing"],
  Ground: ["burrowAffinity", "groundedStrike"],
};

async function checkBan(uid) {
  const banSnap = await db.collection("bans")
      .where("userId", "==", uid)
      .where("active", "==", true)
      .limit(1)
      .get();
  if (!banSnap.empty) {
    const ban = banSnap.docs[0].data();
    if (ban.expiresAt && ban.expiresAt.toMillis() > Date.now()) {
      throw httpError("permission-denied", "Account is banned");
    }
  }
}

async function hatchEggLogic(eggId, ownerId) {
  const eggRef = db.collection("eggs").doc(eggId);
  const eggSnap = await eggRef.get();
  if (!eggSnap.exists) throw httpError("not-found", "Egg not found");

  const egg = eggSnap.data();
  if (egg.status !== "incubating") throw httpError("failed-precondition", "Egg not incubating");

  const now = nowMs();
  if (egg.incubationEndsAt.toMillis() > now) {
    throw httpError("failed-precondition", "Egg not ready to hatch");
  }

  const { genomeSeedBlob } = egg;
  const careModifiers = egg.careModifiers || {};
  const rng = createSeededRng(genomeSeedBlob.seed);

  const classWeights = {};
  for (const cls of ["Air", "Ground", "Ocean"]) {
    if (cls === genomeSeedBlob.parentAClass) classWeights[cls] = (classWeights[cls] || 0) + 0.5;
    if (cls === genomeSeedBlob.parentBClass) classWeights[cls] = (classWeights[cls] || 0) + 0.5;
  }
  if (Object.keys(classWeights).length === 0) {
    classWeights["Ground"] = 1;
  }
  const primaryClass = weightedPick(classWeights, rng);

  const rarity = egg.rarity || weightedPick({ common: 0.6, uncommon: 0.3, rare: 0.09, legendary: 0.01 }, rng);

  // Phase 3C: sing care modifier increases mutation chance
  const mutationChanceAdjusted = ARCHETYPE_CANDIDATE_CHANCE + (careModifiers.sing || 0) * 0.0001;
  const mutationHappened = rng() < mutationChanceAdjusted;

  const variance = () => 1 + (rng() - 0.5) * 0.2;
  const baseStats = {
    hp: Math.round(100 * variance()),
    armor: Math.round(50 * variance()),
    energyCap: Math.round(100 * variance()),
    energyRegen: Math.round(15 * variance()),
    speed: Math.round(70 * variance()),
  };

  const classBreeds = BREEDS.filter((b) => b.primaryClass === primaryClass);
  const chosenBreed = classBreeds.length > 0 ?
    classBreeds[Math.floor(rng() * classBreeds.length)] :
    BREEDS[0];

  // Phase 3A: Composite secondary traits
  const secondaryTraits = [];
  const parentsDifferInClass = genomeSeedBlob.parentAClass !== genomeSeedBlob.parentBClass;
  if (parentsDifferInClass) {
    const nurtureBonus = (careModifiers.nurture || 0) * 0.01;
    const compositeRoll = rng();
    if (compositeRoll < genomeSeedBlob.compositeChance + nurtureBonus) {
      const otherClass = genomeSeedBlob.parentAClass === primaryClass ?
        genomeSeedBlob.parentBClass :
        genomeSeedBlob.parentAClass;
      const traitPool = CLASS_TRAIT_POOL[otherClass] || [];
      const traitCount = traitPool.length > 1 && rng() > 0.5 ? 2 : 1;
      // Fisher-Yates shuffle for uniform distribution
      const shuffled = [...traitPool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      for (let i = 0; i < Math.min(traitCount, shuffled.length); i++) {
        secondaryTraits.push(shuffled[i]);
      }
    }
  }

  // Phase 3B: Ability blending
  const blendRoll = rng();
  let primaryAbility = chosenBreed.primaryAbility;
  let abilitySource = "inherited";
  if (blendRoll < BLEND_CHANCE) {
    const otherClass = genomeSeedBlob.parentAClass === primaryClass ?
      genomeSeedBlob.parentBClass :
      genomeSeedBlob.parentAClass;
    const otherBreeds = BREEDS.filter((b) => b.primaryClass === otherClass);
    const otherBreed = otherBreeds.length > 0 ?
      otherBreeds[Math.floor(rng() * otherBreeds.length)] :
      chosenBreed;
    const blended = {
      name: `${chosenBreed.primaryAbility.name} (Hybrid)`,
      description: `A hybrid ability blending ${chosenBreed.name} and ${otherBreed.name} techniques.`,
      damage: Math.round((chosenBreed.primaryAbility.damage + otherBreed.primaryAbility.damage) / 2),
      energyCost: Math.round((chosenBreed.primaryAbility.energyCost + otherBreed.primaryAbility.energyCost) / 2),
      cooldown: Math.round((chosenBreed.primaryAbility.cooldown + otherBreed.primaryAbility.cooldown) / 2),
    };
    primaryAbility = blended;
    abilitySource = "blended";
  }

  // Phase 3D: Visual blending - vfxPaletteId
  let vfxPaletteId = "default";
  if (parentsDifferInClass) {
    const classes = [genomeSeedBlob.parentAClass, genomeSeedBlob.parentBClass].sort();
    vfxPaletteId = `hybrid_${classes[0]}_${classes[1]}`;
  }

  // Phase 3C: warm modifier preserves rarity tier
  const rarityPreserved = !!(careModifiers.warm && rarity === egg.rarity);

  let uniqueModifierTag = null;
  for (let attempt = 0; attempt < UNIQUE_TAG_MAX_ATTEMPTS; attempt++) {
    const candidateTag = mutationHappened ?
      `HYBRID_${eggId.substring(0, 8)}_${attempt}` :
      `${chosenBreed.uniqueModifierTag}_H${attempt}`;

    const registryRef = db.collection("unique_modifier_registry").doc(candidateTag);
    const regSnap = await registryRef.get();
    if (!regSnap.exists) {
      await registryRef.set({
        assigned: true,
        assignedBreedId: null,
        chickenId: null,
        allowedClasses: [primaryClass],
        metadata: { eggId, createdAt: new Date() },
      });
      uniqueModifierTag = candidateTag;
      break;
    }
  }

  if (!uniqueModifierTag) {
    logger.warn("Unique tag allocation failed", { eggId });
    uniqueModifierTag = `FALLBACK_${eggId}`;
  }

  // Phase 4E: Trade lock
  const tradeLock = {};
  if (rarity === "rare") {
    tradeLock.tradeLockUntil = admin.firestore.Timestamp.fromMillis(now + 24 * MILLIS_PER_HOUR);
  } else if (rarity === "legendary") {
    tradeLock.tradeLockUntil = admin.firestore.Timestamp.fromMillis(now + 72 * MILLIS_PER_HOUR);
  }

  const chickenRef = db.collection("chickens").doc();
  const chickenData = {
    ownerId: ownerId || egg.ownerId,
    breedId: chosenBreed.breedId,
    name: chosenBreed.name,
    primaryClass,
    secondaryTraits,
    level: 1,
    xp: 0,
    unspentSkillPoints: 0,
    assignedNodes: {},
    training_value_spent: 0,
    freeRespecUsed: false,
    respecPaidCount: 0,
    parents: { parentAId: egg.parentAId, parentBId: egg.parentBId },
    genomeSnapshot: genomeSeedBlob,
    mutationFlags: mutationHappened ? ["archetype_candidate"] : [],
    breedCount: 0,
    lastBreedAt: null,
    baseStats,
    primaryAbility,
    ultimateAbility: chosenBreed.ultimateAbility,
    abilitySource,
    visualRefs: {
      modelId: primaryClass.toLowerCase(),
      skinId: rarity,
      vfxPaletteId,
    },
    rarity,
    rarityPreserved,
    uniqueModifierTag,
    tradeLock: Object.keys(tradeLock).length > 0 ? tradeLock : null,
    hatchedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.runTransaction(async(tx) => {
    tx.set(chickenRef, chickenData);
    tx.update(eggRef, { status: "hatched", hatchedChickenId: chickenRef.id });

    if (mutationHappened) {
      const candidateRef = db.collection("archetype_candidates").doc();
      tx.set(candidateRef, {
        genomeSnapshot: genomeSeedBlob,
        ownerId: egg.ownerId,
        chickenId: chickenRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedFlag: false,
        telemetrySummary: {},
      });

      // Phase 4D: Discord notification for mutation
      const webhookUrl = getDiscordWebhookUrl();
      if (webhookUrl) {
        sendDiscordNotification(webhookUrl, {
          title: "✨ Archetype Candidate Hatched!",
          description: `A new archetype candidate has hatched!`,
          fields: [
            { name: "Chicken ID", value: chickenRef.id },
            { name: "Rarity", value: rarity },
            { name: "Class", value: primaryClass },
            { name: "Owner", value: egg.ownerId },
          ],
          color: 0xFFD700,
        }).catch((e) => logger.warn("Discord notification failed", { error: e.message }));
      }
    }

    if (uniqueModifierTag && !uniqueModifierTag.startsWith("FALLBACK_")) {
      const regRef = db.collection("unique_modifier_registry").doc(uniqueModifierTag);
      tx.update(regRef, { chickenId: chickenRef.id });
    }
  });

  return { chickenId: chickenRef.id, rarity, primaryClass, mutationHappened, secondaryTraits, abilitySource };
}

exports.hatchEgg = onCall(async(request) => {
  const uid = requireAuth(request);
  await checkBan(uid);
  const { eggId } = request.data;
  if (!eggId) throw httpError("invalid-argument", "eggId required");

  const snap = await db.collection("eggs").doc(eggId).get();
  if (!snap.exists) throw httpError("not-found", "Egg not found");
  if (snap.data().ownerId !== uid) throw httpError("permission-denied", "Not your egg");

  return await hatchEggLogic(eggId, uid);
});

// ── 7. Scheduled: processHatchableEggs ────────────────────────────────────

exports.processHatchableEggs = onSchedule("every 5 minutes", async() => {
  const now = admin.firestore.Timestamp.now();
  const snap = await db.collection("eggs")
      .where("status", "==", "incubating")
      .where("incubationEndsAt", "<=", now)
      .limit(50)
      .get();

  const results = await Promise.allSettled(
      snap.docs.map(async(doc) => {
        try {
          await hatchEggLogic(doc.id, doc.data().ownerId);
          logger.info("Auto-hatched egg", { eggId: doc.id });
        } catch (err) {
          logger.error("Error auto-hatching", { eggId: doc.id, error: err.message });
        }
      }),
  );

  return results;
});

// ── 8. Unique Modifier Registry ────────────────────────────────────────────

exports.getUniqueModifiers = onCall(async(request) => {
  requireAdmin(request);
  const snap = await db.collection("unique_modifier_registry").limit(500).get();
  return snap.docs.map((d) => ({ tag: d.id, ...d.data() }));
});

// ── 9. User / Account ──────────────────────────────────────────────────────

exports.getUserProfile = onCall(async(request) => {
  const uid = requireAuth(request);
  const week = weekKey(nowMs());

  const userSnap = await db.collection("users").doc(uid).get();
  const uData = userSnap.exists ? userSnap.data() : {};

  return {
    userId: uid,
    displayName: uData.displayName || "Trainer",
    balance: uData.balance || 0,
    weeklyBreedCount: (uData.weeklyBreed && uData.weeklyBreed[week]) || 0,
    weeklyTrainingCount: (uData.weeklyTraining && uData.weeklyTraining[week]) || 0,
    weeklyBreedCap: WEEKLY_BREED_CAP,
    weeklyTrainingCap: WEEKLY_TRAINING_SP_CAP,
  };
});

// ── 10. Admin Endpoints ────────────────────────────────────────────────────

exports.getArchetypeCandidates = onCall(async(request) => {
  requireAdmin(request);
  const snap = await db.collection("archetype_candidates")
      .where("reviewedFlag", "==", false)
      .limit(100)
      .get();
  return snap.docs.map((d) => ({ candidateId: d.id, ...d.data() }));
});

exports.promoteCandidate = onCall(async(request) => {
  requireAdmin(request);
  requireFields(request.data, ["candidateId", "tunedParams"]);
  const { candidateId, tunedParams } = request.data;

  const ref = db.collection("archetype_candidates").doc(candidateId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError("not-found", "Candidate not found");

  await ref.update({
    reviewedFlag: true,
    promoted: true,
    tunedParams,
    promotedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Phase 4D: Discord notification for promotion
  const webhookUrl = getDiscordWebhookUrl();
  if (webhookUrl) {
    await sendDiscordNotification(webhookUrl, {
      title: "🏆 Archetype Candidate Promoted!",
      description: `Candidate \`${candidateId}\` has been promoted to archetype.`,
      fields: [
        { name: "Candidate ID", value: candidateId },
        { name: "Tuned Params", value: JSON.stringify(tunedParams) },
      ],
      color: 0x00FF00,
    }).catch((e) => logger.warn("Discord notification failed", { error: e.message }));
  }

  return { success: true };
});

// ── 11. Breed Catalogue ────────────────────────────────────────────────────

exports.getBreedCatalogue = onCall(async() => {
  return { breeds: BREEDS };
});

exports.getBreedsByArea = onCall(async(request) => {
  const { area } = request.data;
  if (!area) throw httpError("invalid-argument", "area required");
  return { breeds: BREEDS.filter((b) => b.area === area) };
});

// ── 12. Telemetry ──────────────────────────────────────────────────────────

const VALID_TELEMETRY_EVENTS = new Set([
  "breed_preview_shown", "breed_confirmed", "egg_hatched",
  "respec_preview_shown", "respec_confirmed", "archetype_candidate_seen",
  "archetype_promoted", "battle_completed", "trade_initiated",
]);

exports.recordTelemetryEvent = onCall(async(request) => {
  const uid = requireAuth(request);
  const { eventType, chickenId = null, eggId = null, metadata = {} } = request.data;

  if (!eventType || !VALID_TELEMETRY_EVENTS.has(eventType)) {
    throw httpError("invalid-argument", "Invalid or missing eventType");
  }

  await db.collection("telemetry_events").add({
    userId: uid,
    eventType,
    chickenId,
    eggId,
    metadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ── 13. Candidate Telemetry Aggregation ────────────────────────────────────

exports.aggregateCandidateTelemetry = onSchedule("every 1 hours", async() => {
  const candidatesSnap = await db.collection("archetype_candidates")
      .where("reviewedFlag", "==", false)
      .limit(100)
      .get();

  await Promise.allSettled(candidatesSnap.docs.map(async(doc) => {
    const candidate = doc.data();
    const chickenId = candidate.chickenId;
    if (!chickenId) return;

    const eventsSnap = await db.collection("telemetry_events")
        .where("chickenId", "==", chickenId)
        .get();

    const summary = { pickCount: 0, useCount: 0, battleCount: 0, tradeCount: 0 };
    for (const ev of eventsSnap.docs) {
      const { eventType } = ev.data();
      if (eventType === "archetype_candidate_seen") summary.pickCount++;
      if (eventType === "breed_confirmed") summary.useCount++;
      if (eventType === "battle_completed") summary.battleCount++;
      if (eventType === "trade_initiated") summary.tradeCount++;
    }

    await doc.ref.update({ telemetrySummary: summary });
  }));
});

// ── 14. Ban / Moderation ───────────────────────────────────────────────────

exports.banUser = onCall(async(request) => {
  requireAdmin(request);
  requireFields(request.data, ["targetUserId", "reason", "durationHours"]);
  const { targetUserId, reason, durationHours } = request.data;
  const adminUid = requireAuth(request);

  const now = nowMs();
  const expiresAt = new Date(now + durationHours * MILLIS_PER_HOUR);

  const banRef = db.collection("bans").doc();
  const userRef = db.collection("users").doc(targetUserId);

  await db.runTransaction(async(tx) => {
    tx.set(banRef, {
      userId: targetUserId,
      reason,
      bannedAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      bannedBy: adminUid,
      active: true,
    });
    tx.set(userRef, {
      banned: true,
      banExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    }, { merge: true });
  });

  const webhookUrl = getDiscordWebhookUrl();
  if (webhookUrl) {
    await sendDiscordNotification(webhookUrl, {
      title: "🚫 User Banned",
      description: `User \`${targetUserId}\` has been banned.`,
      fields: [
        { name: "Reason", value: reason },
        { name: "Duration", value: `${durationHours} hours` },
        { name: "Banned By", value: adminUid },
      ],
      color: 0xFF0000,
    }).catch((e) => logger.warn("Discord notification failed", { error: e.message }));
  }

  return { success: true, banId: banRef.id };
});

exports.unbanUser = onCall(async(request) => {
  requireAdmin(request);
  requireFields(request.data, ["targetUserId"]);
  const { targetUserId } = request.data;

  const bansSnap = await db.collection("bans")
      .where("userId", "==", targetUserId)
      .where("active", "==", true)
      .limit(10)
      .get();

  const userRef = db.collection("users").doc(targetUserId);

  await db.runTransaction(async(tx) => {
    for (const banDoc of bansSnap.docs) {
      tx.update(banDoc.ref, { active: false });
    }
    tx.set(userRef, { banned: false, banExpiresAt: null }, { merge: true });
  });

  return { success: true };
});

// ── 15. Trade Lock ─────────────────────────────────────────────────────────

exports.checkTradeLock = onCall(async(request) => {
  requireAuth(request);
  const { chickenId } = request.data;
  if (!chickenId) throw httpError("invalid-argument", "chickenId required");

  const snap = await db.collection("chickens").doc(chickenId).get();
  if (!snap.exists) throw httpError("not-found", "Chicken not found");
  const chicken = snap.data();

  const now = nowMs();
  const locked = chicken.tradeLock &&
    chicken.tradeLock.tradeLockUntil &&
    chicken.tradeLock.tradeLockUntil.toMillis() > now;

  return {
    canTrade: !locked,
    tradeLockUntil: locked ? chicken.tradeLock.tradeLockUntil.toDate().toISOString() : null,
  };
});
