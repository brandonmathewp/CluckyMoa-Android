package com.cluckymoa.game.ui.adapter;

import android.view.LayoutInflater;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.cluckymoa.game.databinding.ItemBreedCardBinding;
import com.cluckymoa.game.model.Breed;
import com.cluckymoa.game.util.ClassColorUtil;
import com.cluckymoa.game.util.RarityUtil;

import java.util.List;

public class BreedAdapter extends RecyclerView.Adapter<BreedAdapter.ViewHolder> {

    public interface OnBreedClickListener {
        void onBreedClick(Breed breed);
    }

    private final List<Breed> breeds;
    private final OnBreedClickListener listener;

    public BreedAdapter(List<Breed> breeds, OnBreedClickListener listener) {
        this.breeds = breeds;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemBreedCardBinding binding = ItemBreedCardBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);
        return new ViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Breed breed = breeds.get(position);
        holder.binding.textBreedName.setText(breed.name);
        holder.binding.textBreedClass.setText(ClassColorUtil.getLabel(breed.primaryClass));
        holder.binding.textBreedClass.setTextColor(ClassColorUtil.getColor(breed.primaryClass));
        holder.binding.textBreedRarity.setText(RarityUtil.getLabel(breed.rarity));
        holder.binding.textBreedRarity.setTextColor(RarityUtil.getColor(breed.rarity));
        holder.binding.textBreedArea.setText(breed.area);
        holder.itemView.setOnClickListener(v -> listener.onBreedClick(breed));
    }

    @Override
    public int getItemCount() {
        return breeds.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final ItemBreedCardBinding binding;

        ViewHolder(ItemBreedCardBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }
    }
}
