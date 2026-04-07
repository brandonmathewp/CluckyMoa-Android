package com.cluckymoa.game;

import android.os.Bundle;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import com.cluckymoa.game.databinding.ActivityMainBinding;
import com.cluckymoa.game.ui.BreedCatalogueFragment;
import com.cluckymoa.game.ui.ChickenListFragment;
import com.cluckymoa.game.ui.EggInventoryFragment;
import com.cluckymoa.game.ui.ProfileFragment;
import com.google.android.material.navigation.NavigationBarView;
import com.google.firebase.auth.FirebaseAuth;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;
    private FirebaseAuth auth;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        auth = FirebaseAuth.getInstance();
        signInAnonymouslyIfNeeded();

        binding.bottomNav.setOnItemSelectedListener(item -> {
            Fragment fragment = null;
            int id = item.getItemId();
            if (id == R.id.nav_chickens) {
                fragment = new ChickenListFragment();
            } else if (id == R.id.nav_breeds) {
                fragment = new BreedCatalogueFragment();
            } else if (id == R.id.nav_eggs) {
                fragment = new EggInventoryFragment();
            } else if (id == R.id.nav_profile) {
                fragment = new ProfileFragment();
            }
            if (fragment != null) {
                getSupportFragmentManager()
                        .beginTransaction()
                        .replace(R.id.fragment_container, fragment)
                        .commit();
                return true;
            }
            return false;
        });

        if (savedInstanceState == null) {
            binding.bottomNav.setSelectedItemId(R.id.nav_chickens);
        }
    }

    private void signInAnonymouslyIfNeeded() {
        if (auth.getCurrentUser() == null) {
            auth.signInAnonymously();
        }
    }
}
