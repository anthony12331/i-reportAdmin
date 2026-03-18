package com.example.incidentreports;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.Address;
import android.location.Geocoder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.preference.PreferenceManager;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.bumptech.glide.Glide;
import com.google.android.material.button.MaterialButton;

import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

public class IncidentDetailActivity extends AppCompatActivity {
    private static final String TAG = "IncidentDetailActivity";
    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;
    private LoadingDialog loadingDialog;
    private NotificationHelper notificationHelper;

    private TextView txtToolbarTitle;
    private TextView txtDetailStatus, txtDetailDescription;
    private View viewStatusDot;
    private TextView txtDetailLocation, txtDetailLocationSub;
    private TextView txtReporterInitials, txtReporterName;
    private MaterialButton btnAcceptTask;
    private ImageView btnNavigate, btnCall, btnMessage;
    private MapView map = null;

    // Media Views
    private View layoutMedia, cardImage;
    private ImageView imgIncidentMedia;
    private MaterialButton btnPlayVideo;

    private String incidentId;
    private IncidentReport currentIncident;

    private final BroadcastReceiver refreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Log.d(TAG, "Real-time refresh triggered via broadcast.");
            loadIncident();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // OSMDroid configuration
        Configuration.getInstance().load(this, PreferenceManager.getDefaultSharedPreferences(this));

        // Set status bar color
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.dashboard_bg));
        
        // Ensure status bar icons are visible (dark icons for light background)
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);

        setContentView(R.layout.activity_incident_detail);

        sessionManager = new SessionManager(this);
        apiHelper = new PocketBaseApiHelper(this);
        loadingDialog = new LoadingDialog(this);
        notificationHelper = new NotificationHelper(this);

        incidentId = getIntent().getStringExtra("incident_id");
        if (incidentId == null || incidentId.isEmpty()) {
            Toast.makeText(this, "Missing incident ID.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        sessionManager.acknowledgeIncident(incidentId);
        notificationHelper.cancelNotification(incidentId);

        // Bind Views
        txtToolbarTitle = findViewById(R.id.txtToolbarTitle);
        txtDetailStatus = findViewById(R.id.txtDetailStatus);
        txtDetailDescription = findViewById(R.id.txtDetailDescription);
        viewStatusDot = findViewById(R.id.viewStatusDot);
        txtDetailLocation = findViewById(R.id.txtDetailLocation);
        txtDetailLocationSub = findViewById(R.id.txtDetailLocationSub);
        txtReporterInitials = findViewById(R.id.txtReporterInitials);
        txtReporterName = findViewById(R.id.txtReporterName);
        btnAcceptTask = findViewById(R.id.btnAcceptTask);
        btnNavigate = findViewById(R.id.btnNavigate);
        btnCall = findViewById(R.id.btnCall);
        btnMessage = findViewById(R.id.btnMessage);

        layoutMedia = findViewById(R.id.layoutMedia);
        cardImage = findViewById(R.id.cardImage);
        imgIncidentMedia = findViewById(R.id.imgIncidentMedia);
        btnPlayVideo = findViewById(R.id.btnPlayVideo);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        // Initialize Map
        map = findViewById(R.id.mapviewDetail);
        if (map != null) {
            map.setTileSource(TileSourceFactory.MAPNIK);
            map.setMultiTouchControls(true);
            map.getController().setZoom(17.0);
        }

        btnAcceptTask.setOnClickListener(v -> {
            if (currentIncident != null) {
                String nextStatus = "ongoing".equalsIgnoreCase(currentIncident.getStatus()) ? "resolved" : "ongoing";
                updateStatus(nextStatus);
            }
        });

        btnNavigate.setOnClickListener(v -> {
            if (currentIncident != null) {
                openMap(currentIncident.getLatitude(), currentIncident.getLongitude());
            }
        });

        btnCall.setOnClickListener(v -> {
            if (currentIncident != null && currentIncident.getReporterContact() != null && !currentIncident.getReporterContact().isEmpty()) {
                Intent intent = new Intent(Intent.ACTION_DIAL);
                intent.setData(Uri.parse("tel:" + currentIncident.getReporterContact()));
                startActivity(intent);
            } else {
                Toast.makeText(this, "No contact number available", Toast.LENGTH_SHORT).show();
            }
        });

        btnMessage.setOnClickListener(v -> {
            if (currentIncident != null && currentIncident.getReporterContact() != null && !currentIncident.getReporterContact().isEmpty()) {
                Intent intent = new Intent(Intent.ACTION_SENDTO);
                intent.setData(Uri.parse("smsto:" + currentIncident.getReporterContact()));
                startActivity(intent);
            } else {
                Toast.makeText(this, "No contact number available", Toast.LENGTH_SHORT).show();
            }
        });

        loadIncident();
    }

    @Override
    protected void onStart() {
        super.onStart();
        startEmergencyService();
        IntentFilter filter = new IntentFilter("com.example.incidentreports.REFRESH_DASHBOARD");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(refreshReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(refreshReceiver, filter);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        try {
            unregisterReceiver(refreshReceiver);
        } catch (Exception ignored) {}
    }

    private void startEmergencyService() {
        Intent serviceIntent = new Intent(this, EmergencyPollingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void stopAlarm() {
        Intent serviceIntent = new Intent(this, EmergencyPollingService.class);
        serviceIntent.setAction(EmergencyPollingService.ACTION_STOP_ALARM);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void loadIncident() {
        apiHelper.fetchIncidentById(sessionManager.getToken(), incidentId, new PocketBaseApiHelper.IncidentCallback() {
            @Override
            public void onSuccess(IncidentReport incidentReport) {
                currentIncident = incidentReport;
                bindIncident(incidentReport);
            }

            @Override
            public void onError(String message) {
                Toast.makeText(IncidentDetailActivity.this, "Failed to load incident: " + message, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void bindIncident(IncidentReport report) {
        String shortId = report.getId().length() > 6 ? report.getId().substring(0, 6).toUpperCase() : report.getId().toUpperCase();
        txtToolbarTitle.setText("Incident #" + shortId);

        String status = report.getStatus();
        txtDetailStatus.setText(status.substring(0, 1).toUpperCase() + status.substring(1));
        
        if ("pending".equalsIgnoreCase(status)) {
            viewStatusDot.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.accent_orange));
            btnAcceptTask.setText("ACCEPT TASK");
            btnAcceptTask.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.accent_blue));
            btnAcceptTask.setVisibility(View.VISIBLE);
        } else if ("ongoing".equalsIgnoreCase(status)) {
            viewStatusDot.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.accent_blue));
            btnAcceptTask.setText("MARK AS RESOLVED");
            btnAcceptTask.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.accent_green));
            btnAcceptTask.setVisibility(View.VISIBLE);
        } else {
            viewStatusDot.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.accent_green));
            btnAcceptTask.setText("RESOLVED");
            btnAcceptTask.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.text_gray));
            btnAcceptTask.setEnabled(false);
            btnAcceptTask.setVisibility(View.VISIBLE);
        }

        txtDetailDescription.setText(report.getDescription());

        String addressText = getAddressFromLocation(report.getLatitude(), report.getLongitude());
        txtDetailLocation.setText(addressText);
        txtDetailLocationSub.setText("Emergency Location");

        String reporterName = report.getReporterName();
        txtReporterName.setText(reporterName != null ? reporterName : "Anonymous");
        
        if (reporterName != null && !reporterName.trim().isEmpty()) {
            String[] names = reporterName.split(" ");
            String initials = "";
            if (names.length >= 1 && !names[0].isEmpty()) initials += names[0].substring(0, 1).toUpperCase();
            if (initials.isEmpty()) initials = "A";
            txtReporterInitials.setText(initials);
        } else {
            txtReporterInitials.setText("A");
        }

        // Bind Media
        boolean hasMedia = false;
        if (report.hasImage()) {
            hasMedia = true;
            cardImage.setVisibility(View.VISIBLE);
            String imageUrl = apiHelper.getFileUrl(report.getCollectionId(), report.getId(), report.getImageFileName());
            Glide.with(this).load(imageUrl).into(imgIncidentMedia);
        } else {
            cardImage.setVisibility(View.GONE);
        }

        if (report.hasVideo()) {
            hasMedia = true;
            btnPlayVideo.setVisibility(View.VISIBLE);
            String videoUrl = apiHelper.getFileUrl(report.getCollectionId(), report.getId(), report.getVideoFileName());
            btnPlayVideo.setOnClickListener(v -> {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(Uri.parse(videoUrl), "video/*");
                startActivity(intent);
            });
        } else {
            btnPlayVideo.setVisibility(View.GONE);
        }

        layoutMedia.setVisibility(hasMedia ? View.VISIBLE : View.GONE);

        if (map != null) {
            try {
                double lat = Double.parseDouble(report.getLatitude());
                double lon = Double.parseDouble(report.getLongitude());
                
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    GeoPoint point = new GeoPoint(lat, lon);
                    map.getOverlays().clear();
                    Marker marker = new Marker(map);
                    marker.setPosition(point);
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
                    marker.setTitle(report.getType());
                    map.getOverlays().add(marker);
                    map.getController().setCenter(point);
                }
            } catch (Exception e) {
                Log.e(TAG, "Map update failed", e);
            }
        }
    }

    private String getAddressFromLocation(String latStr, String lonStr) {
        if (latStr == null || lonStr == null || latStr.isEmpty() || lonStr.isEmpty()) {
            return "Unknown Location";
        }
        
        try {
            double lat = Double.parseDouble(latStr);
            double lon = Double.parseDouble(lonStr);
            
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                return "Lat: " + latStr + ", Lon: " + lonStr;
            }
            
            Geocoder geocoder = new Geocoder(this, Locale.getDefault());
            List<Address> addresses = geocoder.getFromLocation(lat, lon, 1);
            
            if (addresses != null && !addresses.isEmpty()) {
                Address address = addresses.get(0);
                return address.getAddressLine(0);
            }
        } catch (Exception e) {
            Log.e(TAG, "Geocoding failed", e);
        }
        
        return "Lat: " + latStr + ", Lon: " + lonStr;
    }

    private void openMap(String lat, String lng) {
        try {
            Uri gmmIntentUri = Uri.parse("google.navigation:q=" + lat + "," + lng);
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            mapIntent.setPackage("com.google.android.apps.maps");
            if (mapIntent.resolveActivity(getPackageManager()) != null) {
                startActivity(mapIntent);
            } else {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng)));
            }
        } catch (Exception e) {
            Toast.makeText(this, "Could not open map", Toast.LENGTH_SHORT).show();
        }
    }

    private void updateStatus(String newStatus) {
        loadingDialog.show("Updating status...");
        apiHelper.updateIncidentStatus(sessionManager.getToken(), currentIncident.getId(), newStatus,
                new PocketBaseApiHelper.SimpleCallback() {
                    @Override
                    public void onSuccess() {
                        loadingDialog.dismiss();
                        Toast.makeText(IncidentDetailActivity.this, "Status updated", Toast.LENGTH_SHORT).show();
                        loadIncident();
                    }

                    @Override
                    public void onError(String message) {
                        loadingDialog.dismiss();
                        Toast.makeText(IncidentDetailActivity.this, "Update failed: " + message, Toast.LENGTH_LONG).show();
                    }
                });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (map != null) map.onResume();
        sessionManager.acknowledgeIncident(incidentId);
        notificationHelper.cancelNotification(incidentId);
        stopAlarm();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (map != null) map.onPause();
    }
}
