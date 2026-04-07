package com.cluckymoa.game.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.cluckymoa.game.databinding.FragmentBreedCatalogueBinding;
import com.cluckymoa.game.model.Breed;
import com.cluckymoa.game.network.ApiClient;
import com.cluckymoa.game.ui.adapter.BreedAdapter;
import com.google.android.material.chip.Chip;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;

public class BreedCatalogueFragment extends Fragment {

    private FragmentBreedCatalogueBinding binding;
    private BreedAdapter adapter;
    private final List<Breed> allBreeds = new ArrayList<>();
    private final List<Breed> filteredBreeds = new ArrayList<>();
    private String selectedArea = null;
    private String selectedClass = null;
    private final Gson gson = new Gson();

    private static final String[] AREAS = {"Kauai", "Oahu", "Maui", "Molokai", "Lanai", "Hawaii"};
    private static final String[] AREA_LABELS = {"Kauaʻi", "Oʻahu", "Maui", "Molokaʻi", "Lānaʻi", "Hawaiʻi"};
    private static final String[] CLASSES = {"Air", "Ground", "Ocean"};

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        binding = FragmentBreedCatalogueBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        adapter = new BreedAdapter(filteredBreeds, breed -> {
            Intent intent = new Intent(requireContext(), BreedDetailActivity.class);
            intent.putExtra("breedJson", gson.toJson(breed));
            startActivity(intent);
        });
        binding.recyclerBreeds.setLayoutManager(new androidx.recyclerview.widget.GridLayoutManager(requireContext(), 2));
        binding.recyclerBreeds.setAdapter(adapter);

        setupAreaChips();
        setupClassChips();
        loadBreeds();
    }

    private void setupAreaChips() {
        for (int i = 0; i < AREAS.length; i++) {
            Chip chip = new Chip(requireContext());
            chip.setText(AREA_LABELS[i]);
            chip.setCheckable(true);
            final String area = AREAS[i];
            chip.setOnCheckedChangeListener((buttonView, isChecked) -> {
                selectedArea = isChecked ? area : null;
                applyFilters();
            });
            binding.areaChipGroup.addView(chip);
        }
    }

    private void setupClassChips() {
        for (String cls : CLASSES) {
            Chip chip = new Chip(requireContext());
            chip.setText(cls);
            chip.setCheckable(true);
            chip.setOnCheckedChangeListener((buttonView, isChecked) -> {
                selectedClass = isChecked ? cls : null;
                applyFilters();
            });
            binding.classChipGroup.addView(chip);
        }
    }

    private void loadBreeds() {
        ApiClient.getInstance().getBreedCatalogue()
                .addOnSuccessListener(result -> {
                    allBreeds.clear();
                    Object data = result.getData();
                    if (data instanceof java.util.Map) {
                        Object breedsObj = ((java.util.Map<?, ?>) data).get("breeds");
                        if (breedsObj instanceof List) {
                            Type type = new TypeToken<List<Breed>>() {}.getType();
                            List<Breed> loaded = gson.fromJson(gson.toJson(breedsObj), type);
                            allBreeds.addAll(loaded);
                        }
                    }
                    applyFilters();
                })
                .addOnFailureListener(e ->
                        Toast.makeText(requireContext(), "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }

    private void applyFilters() {
        filteredBreeds.clear();
        for (Breed b : allBreeds) {
            if (selectedArea != null && !selectedArea.equals(b.area)) continue;
            if (selectedClass != null && !selectedClass.equals(b.primaryClass)) continue;
            filteredBreeds.add(b);
        }
        adapter.notifyDataSetChanged();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
