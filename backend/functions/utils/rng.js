"use strict";

/**
 * Deterministic seeded RNG (mulberry32 algorithm).
 * Given the same seed, always produces the same sequence.
 */

function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded RNG from a string seed.
 */
function createSeededRng(strSeed) {
  let hash = 0;
  for (let i = 0; i < strSeed.length; i++) {
    hash = Math.imul(31, hash) + strSeed.charCodeAt(i) | 0;
  }
  return mulberry32(hash);
}

/**
 * Pick an item from a weighted distribution using a provided RNG.
 * @param {Object} weights  { key: weight }
 * @param {Function} rng    seeded RNG function
 * @returns {string}        chosen key
 */
function weightedPick(weights, rng) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [key, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return key;
  }
  return Object.keys(weights)[Object.keys(weights).length - 1];
}

module.exports = { createSeededRng, weightedPick };
