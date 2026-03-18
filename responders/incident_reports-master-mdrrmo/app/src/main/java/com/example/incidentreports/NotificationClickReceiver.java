package com.example.incidentreports;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NotificationClickReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent stopIntent = new Intent(EmergencyPollingService.ACTION_STOP_ALARM);
        stopIntent.setPackage(context.getPackageName());
        context.sendBroadcast(stopIntent);

        String incidentId = intent.getStringExtra("incident_id");
        Intent launchIntent;
        if (incidentId != null && !incidentId.trim().isEmpty()) {
            SessionManager sessionManager = new SessionManager(context);
            sessionManager.acknowledgeIncident(incidentId);

            launchIntent = new Intent(context, IncidentDetailActivity.class);
            launchIntent.putExtra("incident_id", incidentId);
        } else {
            launchIntent = new Intent(context, DashboardActivity.class);
        }

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        context.startActivity(launchIntent);
    }
}
