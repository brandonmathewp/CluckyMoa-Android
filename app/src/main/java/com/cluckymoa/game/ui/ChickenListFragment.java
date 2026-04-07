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

import com.cluckymoa.game.databinding.FragmentChickenListBinding;
import com.cluckymoa.game.model.Chicken;
import com.cluckymoa.game.network.ApiClient;
import com.cluckymoa.game.ui.adapter.ChickenAdapter;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ChickenListFragment extends Fragment {

    private FragmentChickenListBinding binding;
    private ChickenAdapter adapter;
    private final List<Chicken> chickens = new ArrayList<>();
    private final Gson gson = new Gson();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        binding = FragmentChickenListBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        adapter = new ChickenAdapter(chickens, chicken -> {
            Intent intent = new Intent(requireContext(), ChickenDetailActivity.class);
            intent.putExtra("chickenId", chicken.chickenId);
            intent.putExtra("chickenJson", gson.toJson(chicken));
            startActivity(intent);
        });
        binding.recyclerChickens.setLayoutManager(new androidx.recyclerview.widget.LinearLayoutManager(requireContext()));
        binding.recyclerChickens.setAdapter(adapter);

        binding.swipeRefresh.setOnRefreshListener(this::loadChickens);
        loadChickens();
    }

    private void loadChickens() {
        binding.swipeRefresh.setRefreshing(true);
        ApiClient.getInstance().getOwnedChickens()
                .addOnSuccessListener(result -> {
                    chickens.clear();
                    Object data = result.getData();
                    if (data instanceof List) {
                        Type type = new TypeToken<List<Chicken>>() {}.getType();
                        List<Chicken> loaded = gson.fromJson(gson.toJson(data), type);
                        chickens.addAll(loaded);
                    }
                    adapter.notifyDataSetChanged();
                    binding.swipeRefresh.setRefreshing(false);
                    binding.emptyState.setVisibility(chickens.isEmpty() ? View.VISIBLE : View.GONE);
                })
                .addOnFailureListener(e -> {
                    binding.swipeRefresh.setRefreshing(false);
                    Toast.makeText(requireContext(), "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
