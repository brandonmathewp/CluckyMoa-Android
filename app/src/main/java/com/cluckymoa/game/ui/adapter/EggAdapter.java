package com.cluckymoa.game.ui.adapter;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.cluckymoa.game.databinding.ItemEggCardBinding;
import com.cluckymoa.game.model.Egg;
import com.cluckymoa.game.util.RarityUtil;
import com.cluckymoa.game.util.TimeUtils;

import java.util.List;

public class EggAdapter extends RecyclerView.Adapter<EggAdapter.ViewHolder> {

    public interface OnHatchClickListener {
        void onHatchClick(String eggId);
    }

    private final List<Egg> eggs;
    private final OnHatchClickListener listener;

    public EggAdapter(List<Egg> eggs, OnHatchClickListener listener) {
        this.eggs = eggs;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemEggCardBinding binding = ItemEggCardBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);
        return new ViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Egg egg = eggs.get(position);
        holder.binding.textEggRarity.setText(RarityUtil.getLabel(egg.rarity));
        holder.binding.textEggRarity.setTextColor(RarityUtil.getColor(egg.rarity));
        holder.binding.textEggStatus.setText("Status: " + egg.status);

        boolean ready = egg.incubationEndsAt != null && TimeUtils.isReady(egg.incubationEndsAt);
        if (ready) {
            holder.binding.textEggTimer.setText("Ready to hatch!");
            holder.binding.btnHatch.setVisibility(View.VISIBLE);
            holder.binding.btnHatch.setOnClickListener(v -> listener.onHatchClick(egg.eggId));
        } else {
            long remaining = egg.incubationEndsAt != null ? TimeUtils.millisUntil(egg.incubationEndsAt) : 0;
            holder.binding.textEggTimer.setText(TimeUtils.formatCountdown(remaining));
            holder.binding.btnHatch.setVisibility(View.GONE);
        }
    }

    @Override
    public int getItemCount() {
        return eggs.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final ItemEggCardBinding binding;

        ViewHolder(ItemEggCardBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }
    }
}
