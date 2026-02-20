package com.example.incidentreports;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.bumptech.glide.Glide;

public class IncidentDetailActivity extends AppCompatActivity {
    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;

    private TextView txtType;
    private TextView txtDescription;
    private TextView txtLocation;
    private TextView txtStatus;
    private TextView txtDate;
    private ImageView imgIncident;
    private Button btnRespond;
    private Button btnResolve;
    private Button btnOpenMap;
    private ProgressBar progressBar;

    private String incidentId;
    private IncidentReport currentIncident;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_incident_detail);

        sessionManager = new SessionManager(this);
        apiHelper = new PocketBaseApiHelper(this);

        incidentId = getIntent().getStringExtra("incident_id");
        if (incidentId == null || incidentId.isEmpty()) {
            Toast.makeText(this, "Missing incident ID.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        txtType = findViewById(R.id.txtDetailType);
        txtDescription = findViewById(R.id.txtDetailDescription);
        txtLocation = findViewById(R.id.txtDetailLocation);
        txtStatus = findViewById(R.id.txtDetailStatus);
        txtDate = findViewById(R.id.txtDetailDateTime);
        imgIncident = findViewById(R.id.imgIncident);
        btnRespond = findViewById(R.id.btnRespond);
        btnResolve = findViewById(R.id.btnResolve);
        btnOpenMap = findViewById(R.id.btnOpenMap);
        progressBar = findViewById(R.id.progressDetail);

        btnRespond.setOnClickListener(v -> updateStatus("ongoing"));
        btnResolve.setOnClickListener(v -> updateStatus("resolved"));

        btnOpenMap.setOnClickListener(v -> {
            if (currentIncident != null) {
                openMap(currentIncident.getLatitude(), currentIncident.getLongitude());
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadIncident();
    }

    private void loadIncident() {
        setLoading(true);
        apiHelper.fetchIncidentById(sessionManager.getToken(), incidentId, new PocketBaseApiHelper.IncidentCallback() {
            @Override
            public void onSuccess(IncidentReport incidentReport) {
                setLoading(false);
                currentIncident = incidentReport;
                bindIncident(incidentReport);
            }

            @Override
            public void onError(String message) {
                setLoading(false);
                Toast.makeText(IncidentDetailActivity.this, "Failed to load incident: " + message, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void bindIncident(IncidentReport report) {
        txtType.setText(report.getType());
        txtDescription.setText(report.getDescription());
        txtDate.setText(report.getCreated());
        txtLocation.setText("Lat: " + report.getLatitude() + "\nLng: " + report.getLongitude());
        txtStatus.setText(report.getStatus());

        if (report.hasImage()) {
            imgIncident.setVisibility(View.VISIBLE);
            Glide.with(this)
                    .load(apiHelper.getFileUrl(report))
                    .centerCrop()
                    .into(imgIncident);
        } else {
            imgIncident.setVisibility(View.GONE);
        }

        // Status change rules for fire personnel:
        // pending -> ongoing (RESPOND)
        // ongoing -> resolved (RESOLVE)
        // resolved -> no actions
        btnRespond.setVisibility("pending".equalsIgnoreCase(report.getStatus()) ? View.VISIBLE : View.GONE);
        btnResolve.setVisibility("ongoing".equalsIgnoreCase(report.getStatus()) ? View.VISIBLE : View.GONE);

        // Show map button if coordinates are available
        if (report.getLatitude() != null && !report.getLatitude().isEmpty() &&
            report.getLongitude() != null && !report.getLongitude().isEmpty()) {
            btnOpenMap.setVisibility(View.VISIBLE);
        } else {
            btnOpenMap.setVisibility(View.GONE);
        }
    }

    private void openMap(String lat, String lng) {
        Uri gmmIntentUri = Uri.parse("geo:" + lat + "," + lng + "?q=" + lat + "," + lng + "(Emergency)");
        Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
        mapIntent.setPackage("com.google.android.apps.maps");
        if (mapIntent.resolveActivity(getPackageManager()) != null) {
            startActivity(mapIntent);
        } else {
            // Fallback for when Google Maps is not installed
            Intent webMapIntent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng));
            startActivity(webMapIntent);
        }
    }

    private void updateStatus(String newStatus) {
        if (currentIncident == null) {
            return;
        }
        setLoading(true);
        apiHelper.updateIncidentStatus(sessionManager.getToken(), currentIncident.getId(), newStatus,
                new PocketBaseApiHelper.SimpleCallback() {
                    @Override
                    public void onSuccess() {
                        setLoading(false);
                        Toast.makeText(IncidentDetailActivity.this, "Status updated to " + newStatus, Toast.LENGTH_SHORT).show();
                        loadIncident();
                    }

                    @Override
                    public void onError(String message) {
                        setLoading(false);
                        Toast.makeText(IncidentDetailActivity.this, "Update failed: " + message, Toast.LENGTH_LONG).show();
                    }
                });
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
    }
}
