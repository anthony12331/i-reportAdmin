package com.example.incidentreports;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Stores runtime API settings such as PocketBase base URL.
 */
public class ApiConfigManager {
    private static final String PREF_NAME = "api_config";
    private static final String KEY_BASE_URL = "base_url";

    private final SharedPreferences sharedPreferences;

    public ApiConfigManager(Context context) {
        sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public String getBaseUrl() {
        return sharedPreferences.getString(KEY_BASE_URL, BuildConfig.POCKETBASE_URL);
    }

    public void setBaseUrl(String url) {
        sharedPreferences.edit().putString(KEY_BASE_URL, url).apply();
    }
}
