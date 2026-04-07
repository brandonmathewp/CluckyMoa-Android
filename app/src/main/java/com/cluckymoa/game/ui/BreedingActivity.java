package com.cluckymoa.game.ui;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.cluckymoa.game.databinding.ActivityBreedingBinding;
import com.cluckymoa.game.model.BreedingPreview;
import com.cluckymoa.game.model.Chicken;
import com.cluckymoa.game.network.ApiClient;
import com.cluckymoa.game.util.IdempotencyUtil;
import com.google.gson.Gson;

import java.util.ArrayList;
import java.util.Locale;
import java.util.Map;

public class BreedingActivity extends AppCompatActivity {

    private ActivityBreedingBinding binding;
    private Chicken parentA;
    private Chicken parentB;
    private BreedingPreview currentPreview;
    private final Gson gson = new Gson();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityBreedingBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        String parentAJson = getIntent().getStringExtra("parentAJson");
        if (parentAJson != null) {
            parentA = gson.fromJson(parentAJson, Chicken.class);
            binding.textParentA.setText("Parent A: " + parentA.name);
        }

        binding.btnSelectParentB.setOnClickListener(v ->
                Toast.makeText(this, "Select a chicken from your inventory", Toast.LENGTH_SHORT).show());

        binding.btnPreview.setOnClickListener(v -> {
            if (parentA == null || parentB == null) {
                Toast.makeText(this, "Select both parents first", Toast.LENGTH_SHORT).show();
                return;
            }
            loadPreview();
        });

        binding.btnConfirmBreed.setOnClickListener(v -> {
            if (currentPreview == null) {
                Toast.makeText(this, "Load a preview first", Toast.LENGTH_SHORT).show();
                return;
            }
            confirmBreeding();
        });

        binding.btnConfirmBreed.setEnabled(false);
    }

    private void loadPreview() {
        binding.progressBar.setVisibility(View.VISIBLE);
        ApiClient.getInstance().breedingPreview(parentA.chickenId, parentB.chickenId, new ArrayList<>())
                .addOnSuccessListener(result -> {
                    binding.progressBar.setVisibility(View.GONE);
                    currentPreview = gson.fromJson(gson.toJson(result.getData()), BreedingPreview.class);
                    if (currentPreview != null) {
                        showPreviewInfo(currentPreview);
                        binding.btnConfirmBreed.setEnabled(true);
                    }
                })
                .addOnFailureListener(e -> {
                    binding.progressBar.setVisibility(View.GONE);
                    Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    private void showPreviewInfo(BreedingPreview preview) {
        StringBuilder sb = new StringBuilder();
        sb.append("Cost: ").append(preview.cost).append(" coins\n");
        sb.append("Incubation: ").append(preview.incubationSeconds / 3600).append("h\n");
        sb.append("Mutation chance: ").append(
                String.format(Locale.US, "%.3f%%", preview.mutationChance * 100)).append("\n");
        if (preview.classProbabilities != null) {
            sb.append("Class probabilities:\n");
            for (Map.Entry<String, Double> entry : preview.classProbabilities.entrySet()) {
                sb.append("  ").append(entry.getKey()).append(": ")
                        .append(String.format(Locale.US, "%.0f%%", entry.getValue() * 100)).append("\n");
            }
        }
        binding.textPreviewInfo.setText(sb.toString());
        binding.textPreviewInfo.setVisibility(View.VISIBLE);
    }

    private void confirmBreeding() {
        new AlertDialog.Builder(this)
                .setTitle("Confirm Breeding")
                .setMessage("Cost: " + currentPreview.cost + " coins. Proceed?")
                .setPositiveButton("Breed", (d, w) -> {
                    String token = IdempotencyUtil.generate();
                    ApiClient.getInstance().breedingConfirm(
                            parentA.chickenId, parentB.chickenId, new ArrayList<>(), token)
                            .addOnSuccessListener(result -> {
                                Toast.makeText(this, "Egg created! Check egg inventory.", Toast.LENGTH_LONG).show();
                                finish();
                            })
                            .addOnFailureListener(e ->
                                    Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                })
                .setNegativeButton("Cancel", null)
                .show();
    }
}
