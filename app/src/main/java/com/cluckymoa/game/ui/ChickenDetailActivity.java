package com.cluckymoa.game.ui;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.cluckymoa.game.databinding.ActivityChickenDetailBinding;
import com.cluckymoa.game.model.Chicken;
import com.cluckymoa.game.model.RespecPreview;
import com.cluckymoa.game.network.ApiClient;
import com.cluckymoa.game.util.ClassColorUtil;
import com.cluckymoa.game.util.IdempotencyUtil;
import com.cluckymoa.game.util.RarityUtil;
import com.google.gson.Gson;

public class ChickenDetailActivity extends AppCompatActivity {

    private ActivityChickenDetailBinding binding;
    private Chicken chicken;
    private final Gson gson = new Gson();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityChickenDetailBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        String json = getIntent().getStringExtra("chickenJson");
        if (json != null) {
            chicken = gson.fromJson(json, Chicken.class);
            populateUI();
        }

        binding.btnRespec.setOnClickListener(v -> showRespecPreview());
        binding.btnBreed.setOnClickListener(v -> {
            Intent intent = new Intent(this, BreedingActivity.class);
            intent.putExtra("parentAJson", gson.toJson(chicken));
            startActivity(intent);
        });
    }

    private void populateUI() {
        binding.textChickenName.setText(chicken.name);
        binding.textChickenClass.setText(ClassColorUtil.getLabel(chicken.primaryClass));
        binding.textChickenClass.setTextColor(ClassColorUtil.getColor(chicken.primaryClass));
        binding.textRarity.setText(RarityUtil.getLabel(chicken.rarity));
        binding.textRarity.setTextColor(RarityUtil.getColor(chicken.rarity));
        binding.textLevel.setText("Level " + chicken.level);
        binding.textSkillPoints.setText("Skill Points: " + chicken.unspentSkillPoints);

        if (chicken.baseStats != null) {
            binding.textStatHp.setText("HP: " + chicken.baseStats.hp);
            binding.textStatArmor.setText("Armor: " + chicken.baseStats.armor);
            binding.textStatEnergy.setText("Energy: " + chicken.baseStats.energyCap);
            binding.textStatRegen.setText("Regen: " + chicken.baseStats.energyRegen);
            binding.textStatSpeed.setText("Speed: " + chicken.baseStats.speed);
        }

        if (chicken.primaryAbility != null) {
            binding.textPrimaryAbilityName.setText(chicken.primaryAbility.name);
            binding.textPrimaryAbilityDesc.setText(chicken.primaryAbility.description);
            binding.textPrimaryAbilityStats.setText(
                    "Dmg: " + chicken.primaryAbility.damage +
                            " | Cost: " + chicken.primaryAbility.energyCost +
                            " | CD: " + chicken.primaryAbility.cooldown + "s");
        }

        if (chicken.ultimateAbility != null) {
            binding.textUltAbilityName.setText(chicken.ultimateAbility.name);
            binding.textUltAbilityDesc.setText(chicken.ultimateAbility.description);
            binding.textUltAbilityStats.setText(
                    "Dmg: " + chicken.ultimateAbility.damage +
                            " | Cost: " + chicken.ultimateAbility.energyCost +
                            " | CD: " + chicken.ultimateAbility.cooldown + "s" +
                            " | Req Lv: " + chicken.ultimateAbility.levelRequired);
        }
    }

    private void showRespecPreview() {
        ApiClient.getInstance().getRespecPreview(chicken.chickenId)
                .addOnSuccessListener(result -> {
                    RespecPreview preview = gson.fromJson(gson.toJson(result.getData()), RespecPreview.class);
                    if (preview == null) return;

                    String msg = preview.free
                            ? "This respec is FREE.\nAll skill points will be reset."
                            : "Fee: " + preview.fee + " coins\n" +
                            "Refund: " + preview.refundAmount + " coins\n" +
                            "Net: " + preview.net + " coins\n" +
                            "Required balance: " + preview.balanceRequired + " coins";

                    new AlertDialog.Builder(this)
                            .setTitle("Respec Preview")
                            .setMessage(msg)
                            .setPositiveButton("Confirm", (dialog, which) -> executeRespec())
                            .setNegativeButton("Cancel", null)
                            .show();
                })
                .addOnFailureListener(e ->
                        Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }

    private void executeRespec() {
        String token = IdempotencyUtil.generate();
        ApiClient.getInstance().confirmRespec(chicken.chickenId, token)
                .addOnSuccessListener(result ->
                        Toast.makeText(this, "Respec successful!", Toast.LENGTH_SHORT).show())
                .addOnFailureListener(e ->
                        Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }
}
