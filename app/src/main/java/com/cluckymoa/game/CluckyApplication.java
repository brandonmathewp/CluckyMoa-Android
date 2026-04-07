package com.cluckymoa.game;

import android.app.Application;
import com.google.firebase.FirebaseApp;

public class CluckyApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        FirebaseApp.initializeApp(this);
    }
}
