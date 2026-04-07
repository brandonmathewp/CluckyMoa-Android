"use strict";

const { db } = require("../config/firebaseAdmin");

/**
 * Validate and consume an idempotency token.
 * Tokens are stored in `idempotency_tokens/{uid}_{token}`.
 * Returns true if this is the first time we've seen the token.
 * Throws if the token has already been used.
 */
async function validateIdempotencyToken(uid, token) {
  if (!token || typeof token !== "string" || token.length < 8) {
    throw new Error("Invalid idempotency token.");
  }

  const docRef = db.collection("idempotency_tokens").doc(`${uid}_${token}`);
  const snap = await docRef.get();

  if (snap.exists) {
    throw new Error("Idempotency token already used.");
  }

  // Reserve the token immediately (set with merge=false so concurrent writes fail)
  await docRef.create({ uid, token, createdAt: new Date() });
  return true;
}

module.exports = { validateIdempotencyToken };
