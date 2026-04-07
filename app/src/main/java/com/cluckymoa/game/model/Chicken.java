package com.cluckymoa.game.model;

import java.util.List;
import java.util.Map;

public class Chicken {
    public String chickenId;
    public String ownerId;
    public String breedId;
    public String name;
    public String primaryClass;
    public List<String> secondaryTraits;
    public int level;
    public long xp;
    public int unspentSkillPoints;
    public Map<String, Object> assignedNodes;
    public long training_value_spent;
    public boolean freeRespecUsed;
    public int respecPaidCount;
    public Map<String, String> parents;
    public Map<String, Object> genomeSnapshot;
    public List<String> mutationFlags;
    public int breedCount;
    public Long lastBreedAt;
    public BaseStats baseStats;
    public Ability primaryAbility;
    public Ability ultimateAbility;
    public Map<String, String> visualRefs;
    public String rarity;
    public String uniqueModifierTag;
}
