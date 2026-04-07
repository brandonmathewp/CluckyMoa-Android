# CluckyMoa — Setup Instructions

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Firebase Project Setup](#2-firebase-project-setup)
3. [Android App Configuration](#3-android-app-configuration)
4. [Deploying Cloud Functions](#4-deploying-cloud-functions)
5. [Firestore Security Rules](#5-firestore-security-rules)
6. [Realtime Database Seed](#6-realtime-database-seed)
7. [Admin Claims & User Roles](#7-admin-claims--user-roles)
8. [Discord Webhook Integration](#8-discord-webhook-integration)
9. [Ban & Moderation System](#9-ban--moderation-system)
10. [Game Tuning Parameters](#10-game-tuning-parameters)
11. [Telemetry & Candidate Promotion](#11-telemetry--candidate-promotion)

---

## 1. Prerequisites

- **Node.js** 18+ and **npm** 9+
- **Java** 17+ (for Android build)
- **Android Studio** Giraffe or newer
- **Firebase CLI** 13+
- **Google Account** with billing enabled (for Cloud Functions v2)

```bash
npm install -g firebase-tools
firebase login
firebase --version  # should be 13+
```

---

## 2. Firebase Project Setup

### 2a. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → give it a name (e.g. `cluckymoa-prod`)
3. Enable **Google Analytics** (optional but recommended)
4. Enable **Blaze (pay-as-you-go)** billing plan (required for Cloud Functions v2)

### 2b. Enable services

In the Firebase console, enable:
- **Authentication** → Sign-in method → Enable **Google** and **Email/Password**
- **Cloud Firestore** → Create database → Start in **production mode**
- **Realtime Database** → Create database → Start in **locked mode**
- **Cloud Functions** (automatically enabled with Blaze plan)
- **Cloud Storage** (for future asset uploads)

### 2c. Initialize Firebase in the project

```bash
cd backend/
firebase use --add   # select your project and give it alias "default"
```

---

## 3. Android App Configuration

1. In Firebase Console → Project Settings → Add Android app
2. Package name: `com.cluckymoa.android` (verify in `app/build.gradle.kts`)
3. Download `google-services.json` and place it at `app/google-services.json`
4. Sync Gradle in Android Studio

```bash
# Build the app from command line
./gradlew assembleDebug
```

---

## 4. Deploying Cloud Functions

### 4a. Install dependencies

```bash
cd backend/functions
npm install
```

### 4b. Deploy all functions

```bash
cd backend/
firebase deploy --only functions
```

### 4c. Deploy a single function

```bash
firebase deploy --only functions:hatchEgg
firebase deploy --only functions:breedingConfirm
firebase deploy --only functions:banUser
firebase deploy --only functions:recordTelemetryEvent
```

### 4d. View function logs

```bash
firebase functions:log
firebase functions:log --only hatchEgg
```

### 4e. Emulate locally

```bash
cd backend/
firebase emulators:start --only functions,firestore,database
```

---

## 5. Firestore Security Rules

### 5a. Deploy rules

```bash
cd backend/
firebase deploy --only firestore:rules
```

### 5b. Rules summary

| Collection | Read | Write |
|---|---|---|
| `users` | Owner or Admin | Cloud Functions only |
| `chickens` | Owner or Admin | Cloud Functions only |
| `eggs` | Owner or Admin | Cloud Functions only |
| `unique_modifier_registry` | Authenticated | Cloud Functions only |
| `archetype_candidates` | Admin only | Cloud Functions only |
| `bans` | Admin only | Admin only |
| `telemetry_events` | Admin only | Cloud Functions only |
| `idempotency_tokens` | Nobody | Nobody |

### 5c. Test rules locally

```bash
cd backend/
firebase emulators:start --only firestore
# Then run the rules test suite if present
```

---

## 6. Realtime Database Seed

The file `backend/rtdb_seed.json` contains the full game configuration including all 60 breeds across 6 Hawaiian islands.

### 6a. Upload seed data

```bash
cd backend/
firebase database:set / rtdb_seed.json
```

> ⚠️ This **overwrites** the entire RTDB root. Only run on a fresh database.

### 6b. Upload specific sections only

```bash
firebase database:set /game_config rtdb_seed.json --source game_config
# Or use the REST API to update individual paths
```

### 6c. RTDB structure

```
/
├── game_config/           # Game constants (costs, caps, chances)
├── areas/                 # 6 Hawaii island definitions
│   ├── Kauai/
│   ├── Oahu/
│   ├── Maui/
│   ├── Molokai/
│   ├── Lanai/
│   └── Hawaii/
├── skill_tree/            # Skill nodes and prerequisites
│   ├── nodes/
│   └── prerequisites/
├── breeds/                # 60 breed definitions keyed by breedId
│   ├── kauai_001/
│   ├── kauai_002/
│   └── ...
└── unique_modifier_registry/   # Registry of all breed modifier tags
```

---

## 7. Admin Claims & User Roles

Admin privileges are granted via Firebase Auth custom claims. Only users with `admin: true` in their token can access admin endpoints (`banUser`, `unbanUser`, `promoteCandidate`, etc.).

### 7a. Grant admin claim (Firebase Admin SDK — run locally)

```javascript
// scripts/set-admin.js (run with: node scripts/set-admin.js)
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const uid = "USER_UID_HERE";
admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => console.log(`Admin claim set for ${uid}`))
  .catch(console.error);
```

```bash
node scripts/set-admin.js
```

### 7b. Verify the claim

```bash
# Using Firebase CLI
firebase auth:export users.json
# Check the customAttributes field for the target user
```

### 7c. Revoke admin claim

```javascript
admin.auth().setCustomUserClaims(uid, { admin: false });
```

> ⚠️ After setting custom claims, the user must **sign out and sign back in** for the new token to take effect.

---

## 8. Discord Webhook Integration

CluckyMoa sends Discord notifications for key events:
- 🚫 **User banned** — fires when `banUser` is called
- ✨ **Archetype candidate hatched** — fires when a mutation occurs during hatching
- 🏆 **Candidate promoted** — fires when `promoteCandidate` is called

### 8a. Create a Discord webhook

1. Open your Discord server → channel settings → **Integrations** → **Webhooks**
2. Click **New Webhook** → copy the webhook URL

### 8b. Configure the webhook URL

**Option A — Firebase Functions config (v1 style):**
```bash
firebase functions:config:set discord.webhook_url="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
firebase deploy --only functions
```

**Option B — Environment variable (recommended for v2 functions):**

Create `backend/functions/.env` (do NOT commit this file):
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

Or set via the Firebase console: **Functions → Configuration → Environment variables**.

### 8c. Test the webhook

```bash
curl -X POST "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"embeds":[{"title":"Test","description":"CluckyMoa webhook test","color":65280}]}'
```

---

## 9. Ban & Moderation System

### 9a. Ban a user

Call the `banUser` Cloud Function (admin only):

```javascript
// From an admin client or trusted backend
const banUser = httpsCallable(functions, "banUser");
await banUser({
  targetUserId: "uid-of-user-to-ban",
  reason: "Cheating — stat manipulation",
  durationHours: 24,
});
```

### 9b. Unban a user

```javascript
const unbanUser = httpsCallable(functions, "unbanUser");
await unbanUser({ targetUserId: "uid-of-user" });
```

### 9c. How bans work

1. A ban document is created in the `bans` Firestore collection with `active: true` and an `expiresAt` timestamp.
2. The user's document in `users` is updated with `banned: true` and `banExpiresAt`.
3. On every protected call (`breedingConfirm`, `hatchEgg`, `confirmRespec`, `applyTrainingItem`, `assignSkillNode`), `checkBan` queries the `bans` collection. If an active, non-expired ban exists, the call throws `permission-denied`.
4. A Discord notification is sent to the configured webhook.

### 9d. Firestore ban document schema

```json
{
  "userId": "string",
  "reason": "string",
  "bannedAt": "Timestamp",
  "expiresAt": "Timestamp",
  "bannedBy": "string (admin uid)",
  "active": true
}
```

---

## 10. Game Tuning Parameters

All tunable constants live in `backend/functions/config/constants.js` and are mirrored in the RTDB under `/game_config`.

| Constant | Default | Description |
|---|---|---|
| `INCUBATION_SECONDS` | `86400` | Egg incubation time (seconds) |
| `BREED_COSTS` | `{common:100, uncommon:250, rare:500, legendary:1000}` | Gold cost per breed tier |
| `RESPEC_BASE_FEE` | `500` | Gold fee for paid respec |
| `RESPEC_REFUND_PCT` | `0.5` | Refund % of training value on respec |
| `COMPOSITE_BASE_CHANCE` | `0.15` | Base chance for secondary trait inheritance |
| `ARCHETYPE_CANDIDATE_CHANCE` | `0.02` | Chance a hatch produces a mutation candidate |
| `BLEND_CHANCE` | `0.15` | Chance abilities blend during hatch |
| `PARENT_COOLDOWN_MS` | `86400000` | Cooldown between breeds per parent (ms) |
| `PARENT_LIFETIME_BREED_CAP` | `5` | Max lifetime breeds per chicken |
| `WEEKLY_BREED_CAP` | `10` | Max breeds per user per week |
| `WEEKLY_TRAINING_SP_CAP` | `20` | Max skill points earned per user per week |

### Care modifier effects

Care actions (applied via `careEgg`) modify hatching probabilities:

| Modifier | Effect |
|---|---|
| `nurture` | +0.01 per stack to `compositeChance` — more secondary traits |
| `sing` | +0.0001 per stack to mutation chance |
| `warm` | Sets `rarityPreserved: true` when rarity matches egg's set rarity |

### Trade lock durations

| Rarity | Lock Duration |
|---|---|
| `rare` | 24 hours |
| `legendary` | 72 hours |
| `common` / `uncommon` | No lock |

---

## 11. Telemetry & Candidate Promotion

### 11a. Record a telemetry event (client-side)

```javascript
const recordTelemetryEvent = httpsCallable(functions, "recordTelemetryEvent");
await recordTelemetryEvent({
  eventType: "egg_hatched",       // must be in VALID_TELEMETRY_EVENTS
  chickenId: "abc123",            // optional
  eggId: "egg456",                // optional
  metadata: { source: "manual" }, // optional
});
```

**Valid event types:**
- `breed_preview_shown`, `breed_confirmed`
- `egg_hatched`
- `respec_preview_shown`, `respec_confirmed`
- `archetype_candidate_seen`, `archetype_promoted`
- `battle_completed`, `trade_initiated`

### 11b. Telemetry aggregation

The `aggregateCandidateTelemetry` function runs **every hour** on a Cloud Scheduler. It:
1. Queries all un-reviewed archetype candidates
2. Counts related telemetry events per candidate's chicken
3. Updates `telemetrySummary` on each candidate doc with `{ pickCount, useCount, battleCount, tradeCount }`

### 11c. Promote a candidate to archetype

```javascript
const promoteCandidate = httpsCallable(functions, "promoteCandidate");
await promoteCandidate({
  candidateId: "candidate-doc-id",
  tunedParams: {
    bonusDmgPct: 10,
    uniquePassiveName: "Hybrid Surge",
  },
});
```

On promotion:
1. The candidate document is updated with `promoted: true`, `reviewedFlag: true`, and `tunedParams`.
2. A 🏆 Discord notification is sent.

### 11d. View candidates (admin)

```javascript
const getArchetypeCandidates = httpsCallable(functions, "getArchetypeCandidates");
const result = await getArchetypeCandidates();
// result.data — array of candidate objects with telemetrySummary
```

### 11e. Check trade lock before trading

```javascript
const checkTradeLock = httpsCallable(functions, "checkTradeLock");
const { data } = await checkTradeLock({ chickenId: "abc123" });
if (!data.canTrade) {
  console.log(`Locked until: ${data.tradeLockUntil}`);
}
```
