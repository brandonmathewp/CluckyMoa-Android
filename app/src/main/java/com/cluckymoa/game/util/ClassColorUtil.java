package com.cluckymoa.game.util;

import android.graphics.Color;

public class ClassColorUtil {

    private ClassColorUtil() {}

    public static int getColor(String primaryClass) {
        if (primaryClass == null) return Color.GRAY;
        switch (primaryClass) {
            case "Air":    return Color.parseColor("#87CEEB");
            case "Ground": return Color.parseColor("#8B4513");
            case "Ocean":  return Color.parseColor("#006994");
            default:       return Color.GRAY;
        }
    }

    public static String getLabel(String primaryClass) {
        if (primaryClass == null) return "Unknown";
        switch (primaryClass) {
            case "Air":    return "✈ Air";
            case "Ground": return "⛰ Ground";
            case "Ocean":  return "🌊 Ocean";
            default:       return primaryClass;
        }
    }
}
