package com.cluckymoa.game.ui;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.cluckymoa.game.databinding.FragmentEggInventoryBinding;
import com.cluckymoa.game.model.Egg;
import com.cluckymoa.game.network.ApiClient;
import com.cluckymoa.game.ui.adapter.EggAdapter;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;

public class EggInventoryFragment extends Fragment {

    private FragmentEggInventoryBinding binding;
    private EggAdapter adapter;
    private final List<Egg> eggs = new ArrayList<>();
    private final Gson gson = new Gson();
    private final Handler timerHandler = new Handler(Looper.getMainLooper());
    private final Runnable timerRunnable = new Runnable() {
        @Override
        public void run() {
            adapter.notifyDataSetChanged();
            timerHandler.postDelayed(this, 1000);
        }
    };

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        binding = FragmentEggInventoryBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        adapter = new EggAdapter(eggs, eggId -> {
            ApiClient.getInstance().hatchEgg(eggId)
                    .addOnSuccessListener(r -> {
                        Toast.makeText(requireContext(), "Egg hatched!", Toast.LENGTH_SHORT).show();
                        loadEggs();
                    })
                    .addOnFailureListener(e ->
                            Toast.makeText(requireContext(), "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
        });
        binding.recyclerEggs.setLayoutManager(new androidx.recyclerview.widget.LinearLayoutManager(requireContext()));
        binding.recyclerEggs.setAdapter(adapter);

        binding.swipeRefresh.setOnRefreshListener(this::loadEggs);
        loadEggs();
    }

    private void loadEggs() {
        binding.swipeRefresh.setRefreshing(true);
        ApiClient.getInstance().getOwnedEggs()
                .addOnSuccessListener(result -> {
                    eggs.clear();
                    Object data = result.getData();
                    if (data instanceof List) {
                        Type type = new TypeToken<List<Egg>>() {}.getType();
                        List<Egg> loaded = gson.fromJson(gson.toJson(data), type);
                        eggs.addAll(loaded);
                    }
                    adapter.notifyDataSetChanged();
                    binding.swipeRefresh.setRefreshing(false);
                    binding.emptyState.setVisibility(eggs.isEmpty() ? View.VISIBLE : View.GONE);
                })
                .addOnFailureListener(e -> {
                    binding.swipeRefresh.setRefreshing(false);
                    Toast.makeText(requireContext(), "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    @Override
    public void onResume() {
        super.onResume();
        timerHandler.post(timerRunnable);
    }

    @Override
    public void onPause() {
        super.onPause();
        timerHandler.removeCallbacks(timerRunnable);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
