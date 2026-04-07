package com.cluckymoa.game.ui.adapter;

import android.view.LayoutInflater;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.cluckymoa.game.databinding.ItemChickenCardBinding;
import com.cluckymoa.game.model.Chicken;
import com.cluckymoa.game.util.ClassColorUtil;
import com.cluckymoa.game.util.RarityUtil;

import java.util.List;

public class ChickenAdapter extends RecyclerView.Adapter<ChickenAdapter.ViewHolder> {

    public interface OnChickenClickListener {
        void onChickenClick(Chicken chicken);
    }

    private final List<Chicken> chickens;
    private final OnChickenClickListener listener;

    public ChickenAdapter(List<Chicken> chickens, OnChickenClickListener listener) {
        this.chickens = chickens;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemChickenCardBinding binding = ItemChickenCardBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);
        return new ViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Chicken chicken = chickens.get(position);
        holder.binding.textChickenName.setText(chicken.name);
        holder.binding.textChickenClass.setText(ClassColorUtil.getLabel(chicken.primaryClass));
        holder.binding.textChickenClass.setTextColor(ClassColorUtil.getColor(chicken.primaryClass));
        holder.binding.textChickenLevel.setText("Lv " + chicken.level);
        holder.binding.textChickenRarity.setText(RarityUtil.getLabel(chicken.rarity));
        holder.binding.textChickenRarity.setTextColor(RarityUtil.getColor(chicken.rarity));
        holder.itemView.setOnClickListener(v -> listener.onChickenClick(chicken));
    }

    @Override
    public int getItemCount() {
        return chickens.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final ItemChickenCardBinding binding;

        ViewHolder(ItemChickenCardBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }
    }
}
