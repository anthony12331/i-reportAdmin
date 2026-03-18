package com.example.incidentreports;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.RelativeLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

public class NotificationAdapter extends RecyclerView.Adapter<NotificationAdapter.ViewHolder> {

    private final List<NotificationItem> notifications;
    private final OnNotificationClickListener clickListener;
    private Context context;

    public interface OnNotificationClickListener {
        void onNotificationClick(NotificationItem notification);
    }

    public NotificationAdapter(Context context, List<NotificationItem> notifications, OnNotificationClickListener listener) {
        this.context = context;
        this.notifications = notifications;
        this.clickListener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_notification, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        holder.bind(notifications.get(position), clickListener);
    }

    @Override
    public int getItemCount() {
        return notifications.size();
    }

    class ViewHolder extends RecyclerView.ViewHolder {
        private final TextView txtTitle, txtMessage, txtTime;
        private final ImageView imgIcon;
        private final View dotUnread, iconBg;
        private final RelativeLayout layoutContent;

        ViewHolder(View itemView) {
            super(itemView);
            txtTitle = itemView.findViewById(R.id.txtNotificationTitle);
            txtMessage = itemView.findViewById(R.id.txtNotificationMessage);
            txtTime = itemView.findViewById(R.id.txtNotificationTime);
            imgIcon = itemView.findViewById(R.id.imgNotificationIcon);
            dotUnread = itemView.findViewById(R.id.dotUnread);
            iconBg = itemView.findViewById(R.id.imgNotificationIconBg);
            layoutContent = itemView.findViewById(R.id.layoutNotificationContent);
        }

        void bind(final NotificationItem notification, final OnNotificationClickListener listener) {
            txtTitle.setText(notification.getTitle());
            txtMessage.setText(notification.getMessage());
            txtTime.setText(getRelativeTime(notification.getCreated()));

            // Set icon and color based on notification type
            String type = notification.getType();
            if ("new_incident".equalsIgnoreCase(type)) {
                imgIcon.setImageResource(R.drawable.falling);
                imgIcon.setColorFilter(ContextCompat.getColor(context, R.color.accent_blue), PorterDuff.Mode.SRC_IN);
            } else if ("incident_resolved".equalsIgnoreCase(type)) {
                imgIcon.setImageResource(R.drawable.ic_check_shield); // Placeholder
                imgIcon.setColorFilter(ContextCompat.getColor(context, R.color.accent_green), PorterDuff.Mode.SRC_IN);
            } else {
                imgIcon.setImageResource(R.drawable.alert); // Default
                 imgIcon.setColorFilter(ContextCompat.getColor(context, R.color.text_gray), PorterDuff.Mode.SRC_IN);
            }

            // Set read/unread state
            if (notification.isRead()) {
                dotUnread.setVisibility(View.GONE);
                ((androidx.cardview.widget.CardView) itemView).setCardBackgroundColor(ContextCompat.getColor(context, R.color.card_bg));
            } else {
                dotUnread.setVisibility(View.VISIBLE);
                ((androidx.cardview.widget.CardView) itemView).setCardBackgroundColor(ContextCompat.getColor(context, R.color.accent_blue_light)); // Use light blue for unread
            }

            itemView.setOnClickListener(v -> listener.onNotificationClick(notification));
        }

        private String getRelativeTime(String isoString) {
            if (isoString == null || isoString.isEmpty()) return "";
            try {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS'Z'", Locale.getDefault());
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date date = sdf.parse(isoString);
                if (date == null) return "";

                long now = System.currentTimeMillis();
                long diff = now - date.getTime();

                long minutes = TimeUnit.MILLISECONDS.toMinutes(diff);
                if (minutes < 1) return "Just Now";
                if (minutes < 60) return minutes + "m ago";

                long hours = TimeUnit.MILLISECONDS.toHours(diff);
                if (hours < 24) return hours + "h ago";

                long days = TimeUnit.MILLISECONDS.toDays(diff);
                return days + "d ago";

            } catch (ParseException e) {
                return isoString; // fallback to raw date
            }
        }
    }
}
