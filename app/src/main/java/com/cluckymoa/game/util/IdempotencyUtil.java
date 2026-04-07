package com.cluckymoa.game.util;

import java.util.UUID;

public class IdempotencyUtil {

    private IdempotencyUtil() {}

    public static String generate() {
        return UUID.randomUUID().toString();
    }
}
