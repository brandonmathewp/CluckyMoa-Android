package com.cluckymoa.game.model;

import java.util.Map;

public class Egg {
    public String eggId;
    public String ownerId;
    public String parentAId;
    public String parentBId;
    public String rarity;
    public Long incubationEndsAt;
    public Map<String, Object> careModifiers;
    public String status;
}
