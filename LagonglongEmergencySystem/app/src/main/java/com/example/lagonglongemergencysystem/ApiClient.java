package com.example.lagonglongemergencysystem;

import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;

public class ApiClient {
    // FIX 1: Use 10.0.2.2 for the Android Studio Emulator
    // FIX 2: Removed the double ":8090:8090" error
    public static final String BASE_URL = "http://10.0.2.2:8090/";

    private static OkHttpClient client;

    public static synchronized OkHttpClient getClient() {
        if (client == null) {
            client = new OkHttpClient.Builder()
                    .connectTimeout(60, TimeUnit.SECONDS) // Great for slow uploads!
                    .writeTimeout(60, TimeUnit.SECONDS)
                    .readTimeout(60, TimeUnit.SECONDS)
                    .build();
        }
        return client;
    }
}