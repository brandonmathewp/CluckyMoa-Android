package com.cluckymoa.game;

import android.app.Application;
import android.content.res.Configuration;

/**
 * Custom Application class for global state management and initialization.
 * This class is instantiated before any activity, service, or receiver.
 */
public class CluckyApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        // Perform one-time global initialization here
        // e.g., Crash reporting, Dependency Injection, Logging Setup, or Shared Preferences setup
    }

    @Override
    public void onTerminate() {
        super.onTerminate();
        // This method is for use in emulated environments. 
        // It is not called on production Android devices.
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Handle global configuration changes like locale or orientation changes
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        // Handle low memory situations globally
    }
}
