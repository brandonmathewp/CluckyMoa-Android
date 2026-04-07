"use strict";

/**
 * Assert that the calling user is authenticated.
 * Works with Firebase Functions v2 onCall `request` argument.
 */
function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new Error("unauthenticated");
  }
  return request.auth.uid;
}

/**
 * Require a field to be present on a data object.
 */
function requireField(data, field) {
  if (data[field] === undefined || data[field] === null) {
    throw new Error(`Missing required field: ${field}`);
  }
}

/**
 * Require all fields to be present.
 */
function requireFields(data, fields) {
  for (const f of fields) {
    requireField(data, f);
  }
}

/**
 * Assert that the caller is an admin (custom claim).
 */
function requireAdmin(request) {
  requireAuth(request);
  if (!request.auth.token || !request.auth.token.admin) {
    throw new Error("permission-denied");
  }
}

module.exports = { requireAuth, requireField, requireFields, requireAdmin };
