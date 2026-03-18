package com.example.incidentreports;

import android.location.Address;
import android.location.Geocoder;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class IncidentAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
    private static final int VIEW_TYPE_DEFAULT = 0;
    private static final int VIEW_TYPE_TASK = 1;

    public interface OnIncidentClickListener {
        void onIncidentClick(IncidentReport incidentReport);
    }

    private final List<IncidentReport> incidents = new ArrayList<>();
    private final OnIncidentClickListener listener;
    private final boolean isTaskView;

    public IncidentAdapter(OnIncidentClickListener listener) {
        this(listener, false);
    }

    public IncidentAdapter(OnIncidentClickListener listener, boolean isTaskView) {
        this.listener = listener;
        this.isTaskView = isTaskView;
    }

    public void submitList(List<IncidentReport> newList) {
        incidents.clear();
        incidents.addAll(newList);
        notifyDataSetChanged();
    }

    @Override
    public int getItemViewType(int position) {
        return isTaskView ? VIEW_TYPE_TASK : VIEW_TYPE_DEFAULT;
    }

    @NonNull
    @Override
    public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        if (viewType == VIEW_TYPE_TASK) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_task, parent, false);
            return new TaskViewHolder(view);
        } else {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_incident_report, parent, false);
            return new IncidentViewHolder(view);
        }
    }

    @Override
    public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int position) {
        IncidentReport report = incidents.get(position);
        if (holder instanceof TaskViewHolder) {
            TaskViewHolder taskHolder = (TaskViewHolder) holder;
            taskHolder.txtTitle.setText(report.getType());
            taskHolder.txtLocation.setText(getAddressFromLocation(holder.itemView, report.getLatitude(), report.getLongitude()));
            taskHolder.txtTime.setText("Reported: " + report.getCreated());
            
            String status = report.getStatus();
            taskHolder.txtStatusTag.setText(status != null ? status.toUpperCase() : "UNKNOWN");
            
            if ("resolved".equalsIgnoreCase(status)) {
                taskHolder.btnAcknowledge.setText("Resolved");
                taskHolder.btnAcknowledge.setBackgroundTintList(ContextCompat.getColorStateList(holder.itemView.getContext(), R.color.text_gray));
                taskHolder.btnAcknowledge.setEnabled(false);
            } else {
                taskHolder.btnAcknowledge.setText("Acknowledge");
                taskHolder.btnAcknowledge.setBackgroundTintList(ContextCompat.getColorStateList(holder.itemView.getContext(), R.color.accent_blue));
                taskHolder.btnAcknowledge.setEnabled(true);
            }
            
            taskHolder.itemView.setOnClickListener(v -> listener.onIncidentClick(report));
            taskHolder.btnAcknowledge.setOnClickListener(v -> listener.onIncidentClick(report));
        } else if (holder instanceof IncidentViewHolder) {
            IncidentViewHolder incidentHolder = (IncidentViewHolder) holder;
            incidentHolder.txtType.setText(report.getType());
            incidentHolder.txtDescription.setText(report.getDescription());
            incidentHolder.txtDateTime.setText(report.getCreated());
            
            String status = report.getStatus();
            incidentHolder.txtStatus.setText(status != null ? status.toUpperCase() : "UNKNOWN");

            int colorResId = R.color.text_label;
            if ("pending".equalsIgnoreCase(status)) {
                colorResId = R.color.status_pending;
            } else if ("ongoing".equalsIgnoreCase(status)) {
                colorResId = R.color.status_ongoing;
            } else if ("resolved".equalsIgnoreCase(status)) {
                colorResId = R.color.status_resolved;
            }
            incidentHolder.txtStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), colorResId));
            holder.itemView.setOnClickListener(v -> listener.onIncidentClick(report));
        }
    }

    private String getAddressFromLocation(View view, String latStr, String lonStr) {
        if (latStr == null || lonStr == null || latStr.isEmpty() || lonStr.isEmpty()) return "Unknown Location";
        try {
            double lat = Double.parseDouble(latStr);
            double lon = Double.parseDouble(lonStr);
            
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                return "Lat: " + latStr + ", Lon: " + lonStr;
            }

            Geocoder geocoder = new Geocoder(view.getContext(), Locale.getDefault());
            List<Address> addresses = geocoder.getFromLocation(lat, lon, 1);
            if (addresses != null && !addresses.isEmpty()) return addresses.get(0).getAddressLine(0);
        } catch (Exception ignored) {}
        return "Lat: " + latStr + ", Lon: " + lonStr;
    }

    @Override
    public int getItemCount() {
        return incidents.size();
    }

    static class IncidentViewHolder extends RecyclerView.ViewHolder {
        TextView txtType, txtDescription, txtDateTime, txtStatus;
        public IncidentViewHolder(@NonNull View itemView) {
            super(itemView);
            txtType = itemView.findViewById(R.id.txtIncidentType);
            txtDescription = itemView.findViewById(R.id.txtDescription);
            txtDateTime = itemView.findViewById(R.id.txtDateTime);
            txtStatus = itemView.findViewById(R.id.txtStatus);
        }
    }

    static class TaskViewHolder extends RecyclerView.ViewHolder {
        TextView txtTitle, txtLocation, txtTime, txtStatusTag;
        MaterialButton btnAcknowledge;
        public TaskViewHolder(@NonNull View itemView) {
            super(itemView);
            txtTitle = itemView.findViewById(R.id.txtTaskTitle);
            txtLocation = itemView.findViewById(R.id.txtTaskLocation);
            txtTime = itemView.findViewById(R.id.txtTaskTime);
            txtStatusTag = itemView.findViewById(R.id.txtTaskStatusTag);
            btnAcknowledge = itemView.findViewById(R.id.btnAcknowledge);
        }
    }
}
