package com.cluckymoa.game.util;

import java.util.concurrent.TimeUnit;

public class TimeUtils {

    private TimeUtils() {}

    /**
     * Format a countdown duration (milliseconds remaining) as "Xh Ym Zs".
     */
    public static String formatCountdown(long remainingMs) {
        if (remainingMs <= 0) return "Ready!";
        long hours   = TimeUnit.MILLISECONDS.toHours(remainingMs);
        long minutes = TimeUnit.MILLISECONDS.toMinutes(remainingMs) % 60;
        long seconds = TimeUnit.MILLISECONDS.toSeconds(remainingMs) % 60;
        if (hours > 0) {
            return hours + "h " + minutes + "m " + seconds + "s";
        } else if (minutes > 0) {
            return minutes + "m " + seconds + "s";
        } else {
            return seconds + "s";
        }
    }

    /**
     * Returns how many milliseconds remain until the given epoch timestamp.
     */
    public static long millisUntil(long epochMs) {
        return epochMs - System.currentTimeMillis();
    }

    public static boolean isReady(long epochMs) {
        return System.currentTimeMillis() >= epochMs;
    }
}
