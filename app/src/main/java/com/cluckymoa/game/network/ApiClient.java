package com.cluckymoa.game.network;

import com.google.android.gms.tasks.Task;
import com.google.firebase.functions.FirebaseFunctions;
import com.google.firebase.functions.HttpsCallableResult;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ApiClient {

    private static ApiClient instance;
    private final FirebaseFunctions functions;

    private ApiClient() {
        functions = FirebaseFunctions.getInstance();
    }

    public static synchronized ApiClient getInstance() {
        if (instance == null) {
            instance = new ApiClient();
        }
        return instance;
    }

    // ── Chicken Management ───────────────────────────────────────────────────

    public Task<HttpsCallableResult> getOwnedChickens() {
        return functions.getHttpsCallable("getOwnedChickens").call();
    }

    public Task<HttpsCallableResult> getChicken(String chickenId) {
        Map<String, Object> data = new HashMap<>();
        data.put("chickenId", chickenId);
        return functions.getHttpsCallable("getChicken").call(data);
    }

    public Task<HttpsCallableResult> updateChickenName(String chickenId, String name) {
        Map<String, Object> data = new HashMap<>();
        data.put("chickenId", chickenId);
        data.put("name", name);
        return functions.getHttpsCallable("updateChickenName").call(data);
    }

    // ── Respec ───────────────────────────────────────────────────────────────

    public Task<HttpsCallableResult> getRespecPreview(String chickenId) {
        Map<String, Object> data = new HashMap<>();
        data.put("chickenId", chickenId);
        return functions.getHttpsCallable("getRespecPreview").call(data);
    }

    public Task<HttpsCallableResult> confirmRespec(String chickenId, String idempotencyToken) {
        Map<String, Object> data = new HashMap<>();
        data.put("chickenId", chickenId);
        data.put("idempotencyToken", idempotencyToken);
        return functions.getHttpsCallable("confirmRespec").call(data);
    }

    // ── Skill Tree ───────────────────────────────────────────────────────────

    public Task<HttpsCallableResult> assignSkillNode(String chickenId, String nodeId) {
        Map<String, Object> data = new HashMap<>();
        data.put("chickenId", chickenId);
        data.put("nodeId", nodeId);
        return functions.getHttpsCallable("assignSkillNode").call(data);
    }

    public Task<HttpsCallableResult> applyTrainingItem(String chickenId, String itemTier) {
        Map<String, Object> data = new HashMap<>();
        data.put("chickenId", chickenId);
        data.put("itemTier", itemTier);
        return functions.getHttpsCallable("applyTrainingItem").call(data);
    }

    // ── Breeding ─────────────────────────────────────────────────────────────

    public Task<HttpsCallableResult> breedingPreview(String parentAId, String parentBId,
                                                      List<Map<String, Object>> consumables) {
        Map<String, Object> data = new HashMap<>();
        data.put("parentAId", parentAId);
        data.put("parentBId", parentBId);
        data.put("consumables", consumables);
        return functions.getHttpsCallable("breedingPreview").call(data);
    }

    public Task<HttpsCallableResult> breedingConfirm(String parentAId, String parentBId,
                                                      List<Map<String, Object>> consumables,
                                                      String idempotencyToken) {
        Map<String, Object> data = new HashMap<>();
        data.put("parentAId", parentAId);
        data.put("parentBId", parentBId);
        data.put("consumables", consumables);
        data.put("idempotencyToken", idempotencyToken);
        return functions.getHttpsCallable("breedingConfirm").call(data);
    }

    // ── Eggs ─────────────────────────────────────────────────────────────────

    public Task<HttpsCallableResult> getOwnedEggs() {
        return functions.getHttpsCallable("getOwnedEggs").call();
    }

    public Task<HttpsCallableResult> getEgg(String eggId) {
        Map<String, Object> data = new HashMap<>();
        data.put("eggId", eggId);
        return functions.getHttpsCallable("getEgg").call(data);
    }

    public Task<HttpsCallableResult> hatchEgg(String eggId) {
        Map<String, Object> data = new HashMap<>();
        data.put("eggId", eggId);
        return functions.getHttpsCallable("hatchEgg").call(data);
    }

    public Task<HttpsCallableResult> accelerateEgg(String eggId, long accelerationSeconds) {
        Map<String, Object> data = new HashMap<>();
        data.put("eggId", eggId);
        data.put("accelerationSeconds", accelerationSeconds);
        return functions.getHttpsCallable("accelerateEgg").call(data);
    }

    public Task<HttpsCallableResult> careAction(String eggId, String actionType) {
        Map<String, Object> data = new HashMap<>();
        data.put("eggId", eggId);
        data.put("actionType", actionType);
        return functions.getHttpsCallable("careAction").call(data);
    }

    // ── Breed Catalogue ──────────────────────────────────────────────────────

    public Task<HttpsCallableResult> getBreedCatalogue() {
        return functions.getHttpsCallable("getBreedCatalogue").call();
    }

    public Task<HttpsCallableResult> getBreedsByArea(String area) {
        Map<String, Object> data = new HashMap<>();
        data.put("area", area);
        return functions.getHttpsCallable("getBreedsByArea").call(data);
    }

    // ── User / Profile ───────────────────────────────────────────────────────

    public Task<HttpsCallableResult> getUserProfile() {
        return functions.getHttpsCallable("getUserProfile").call();
    }
}
