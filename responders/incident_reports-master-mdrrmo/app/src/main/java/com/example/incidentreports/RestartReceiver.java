package com.example.incidentreports;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class RestartReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d("RestartReceiver", "Service stopped! Restarting...");
        SessionManager sessionManager = new SessionManager(context);
        
        if (sessionManager.isLoggedIn()) {
            Intent serviceIntent = new Intent(context, EmergencyPollingService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }
    }
}
