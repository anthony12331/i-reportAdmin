package com.example.incidentreports;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class IncidentAdapter extends RecyclerView.Adapter<IncidentAdapter.IncidentViewHolder> {
    public interface OnIncidentClickListener {
        void onIncidentClick(IncidentReport incidentReport);
    }

    private final List<IncidentReport> incidents = new ArrayList<>();
    private final OnIncidentClickListener listener;

    public IncidentAdapter(OnIncidentClickListener listener) {
        this.listener = listener;
    }

    public void submitList(List<IncidentReport> newList) {
        incidents.clear();
        incidents.addAll(newList);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public IncidentViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_incident_report, parent, false);
        return new IncidentViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull IncidentViewHolder holder, int position) {
        IncidentReport report = incidents.get(position);
        holder.txtType.setText(report.getType());
        holder.txtDescription.setText(report.getDescription());
        holder.txtDateTime.setText(report.getCreated());
        
        String status = report.getStatus();
        holder.txtStatus.setText(status != null ? status.toUpperCase() : "UNKNOWN");

        // Apply highlighting based on status
        int colorResId = R.color.text_label; // default
        if ("pending".equalsIgnoreCase(status)) {
            colorResId = R.color.status_pending;
        } else if ("ongoing".equalsIgnoreCase(status)) {
            colorResId = R.color.status_ongoing;
        } else if ("resolved".equalsIgnoreCase(status)) {
            colorResId = R.color.status_resolved;
        }
        
        holder.txtStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), colorResId));

        holder.itemView.setOnClickListener(v -> listener.onIncidentClick(report));
    }

    @Override
    public int getItemCount() {
        return incidents.size();
    }

    static class IncidentViewHolder extends RecyclerView.ViewHolder {
        TextView txtType;
        TextView txtDescription;
        TextView txtDateTime;
        TextView txtStatus;

        public IncidentViewHolder(@NonNull View itemView) {
            super(itemView);
            txtType = itemView.findViewById(R.id.txtIncidentType);
            txtDescription = itemView.findViewById(R.id.txtDescription);
            txtDateTime = itemView.findViewById(R.id.txtDateTime);
            txtStatus = itemView.findViewById(R.id.txtStatus);
        }
    }
}
