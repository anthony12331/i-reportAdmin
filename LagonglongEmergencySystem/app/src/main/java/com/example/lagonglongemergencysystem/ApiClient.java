package com.example.lagonglongemergencysystem;
import okhttp3.OkHttpClient;
public class ApiClient {
    // This is the IP address where the PocketBase is running.
    // 10.0.2.2 is a special Android alias for "localhost" on your computer.

    public static final String BASE_URL =  "http://10.0.2.2:8090/api/";

    private static OkHttpClient client;

    public static OkHttpClient getClient(){
        if (client==null){
            client = new OkHttpClient();
        }
        return client;
    }
}
