package com.example.incidentreports;

public class NotificationItem {
    private String id;
    private String title;
    private String message;
    private String type;
    private boolean isRead;
    private String created;

    public NotificationItem(String id, String title, String message, String type, boolean isRead, String created) {
        this.id = id;
        this.title = title;
        this.message = message;
        this.type = type;
        this.isRead = isRead;
        this.created = created;
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public String getType() { return type; }
    public boolean isRead() { return isRead; }
    public String getCreated() { return created; }
    
    public void setRead(boolean read) { isRead = read; }
}
