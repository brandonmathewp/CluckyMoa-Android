package com.cluckymoa.game.ui;

import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import com.cluckymoa.game.databinding.ActivityBreedDetailBinding;
import com.cluckymoa.game.model.Breed;
import com.cluckymoa.game.util.ClassColorUtil;
import com.cluckymoa.game.util.RarityUtil;
import com.google.gson.Gson;

public class BreedDetailActivity extends AppCompatActivity {

    private ActivityBreedDetailBinding binding;
    private final Gson gson = new Gson();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityBreedDetailBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        String json = getIntent().getStringExtra("breedJson");
        if (json != null) {
            Breed breed = gson.fromJson(json, Breed.class);
            populateUI(breed);
        }
    }

    private void populateUI(Breed breed) {
        binding.textBreedName.setText(breed.name);
        binding.textBreedClass.setText(ClassColorUtil.getLabel(breed.primaryClass));
        binding.textBreedClass.setTextColor(ClassColorUtil.getColor(breed.primaryClass));
        binding.textBreedRarity.setText(RarityUtil.getLabel(breed.rarity));
        binding.textBreedRarity.setTextColor(RarityUtil.getColor(breed.rarity));
        binding.textBreedArea.setText("Area: " + breed.area);
        binding.textBreedDescription.setText(breed.description);
        binding.textSpawnInfo.setText("Spawn: " + breed.spawnInfo);

        if (breed.primaryAbility != null) {
            binding.textPrimaryAbilityName.setText(breed.primaryAbility.name);
            binding.textPrimaryAbilityDesc.setText(breed.primaryAbility.description);
            binding.textPrimaryAbilityStats.setText(
                    "Dmg: " + breed.primaryAbility.damage +
                            " | Cost: " + breed.primaryAbility.energyCost +
                            " | CD: " + breed.primaryAbility.cooldown + "s");
        }

        if (breed.ultimateAbility != null) {
            binding.textUltAbilityName.setText(breed.ultimateAbility.name);
            binding.textUltAbilityDesc.setText(breed.ultimateAbility.description);
            binding.textUltAbilityStats.setText(
                    "Dmg: " + breed.ultimateAbility.damage +
                            " | Cost: " + breed.ultimateAbility.energyCost +
                            " | CD: " + breed.ultimateAbility.cooldown + "s" +
                            " | Req Lv: " + breed.ultimateAbility.levelRequired);
        }

        if (breed.baseStats != null) {
            binding.textStatHp.setText("HP: " + breed.baseStats.hp);
            binding.textStatArmor.setText("Armor: " + breed.baseStats.armor);
            binding.textStatEnergy.setText("Energy: " + breed.baseStats.energyCap);
            binding.textStatRegen.setText("Regen: " + breed.baseStats.energyRegen);
            binding.textStatSpeed.setText("Speed: " + breed.baseStats.speed);
        }
    }
}
