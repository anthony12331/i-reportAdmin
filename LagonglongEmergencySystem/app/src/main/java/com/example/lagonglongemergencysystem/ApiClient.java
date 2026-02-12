package com.example.lagonglongemergencysystem;

import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;

public class ApiClient {
    // UPDATED: Use your real Wi-Fi IP for physical device testing
    public static final String BASE_URL = "http://192.168.1.11:8090/";

    private static OkHttpClient client;

    public static synchronized OkHttpClient getClient() {
        if (client == null) {
            client = new OkHttpClient.Builder()
                    .connectTimeout(60, TimeUnit.SECONDS)
                    .writeTimeout(60, TimeUnit.SECONDS)
                    .readTimeout(60, TimeUnit.SECONDS)
                    .build();
        }
        return client;
    }
}