package com.cluckymoa.game.util;

import android.graphics.Color;

public class RarityUtil {

    private RarityUtil() {}

    public static int getColor(String rarity) {
        if (rarity == null) return Color.GRAY;
        switch (rarity) {
            case "common":    return Color.parseColor("#808080");
            case "uncommon":  return Color.parseColor("#2E8B57");
            case "rare":      return Color.parseColor("#4169E1");
            case "legendary": return Color.parseColor("#FFD700");
            default:          return Color.GRAY;
        }
    }

    public static String getLabel(String rarity) {
        if (rarity == null) return "Common";
        switch (rarity) {
            case "common":    return "Common";
            case "uncommon":  return "Uncommon";
            case "rare":      return "Rare";
            case "legendary": return "Legendary";
            default:          return rarity.length() > 0
                ? rarity.substring(0, 1).toUpperCase() + rarity.substring(1)
                : "Unknown";
        }
    }
}
