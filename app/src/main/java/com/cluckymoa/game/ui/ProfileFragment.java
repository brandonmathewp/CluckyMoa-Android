package com.cluckymoa.game.ui;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.cluckymoa.game.databinding.FragmentProfileBinding;
import com.cluckymoa.game.model.UserProfile;
import com.cluckymoa.game.network.ApiClient;
import com.google.gson.Gson;

public class ProfileFragment extends Fragment {

    private FragmentProfileBinding binding;
    private final Gson gson = new Gson();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        binding = FragmentProfileBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        loadProfile();
    }

    private void loadProfile() {
        ApiClient.getInstance().getUserProfile()
                .addOnSuccessListener(result -> {
                    UserProfile profile = gson.fromJson(gson.toJson(result.getData()), UserProfile.class);
                    if (profile != null) {
                        binding.textDisplayName.setText(profile.displayName);
                        binding.textBalance.setText(profile.balance + " coins");
                        binding.textBreedCount.setText(
                                profile.weeklyBreedCount + " / " + profile.weeklyBreedCap + " breeds this week");
                        binding.textTrainingCount.setText(
                                profile.weeklyTrainingCount + " / " + profile.weeklyTrainingCap + " SP trained this week");
                    }
                })
                .addOnFailureListener(e ->
                        Toast.makeText(requireContext(), "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
