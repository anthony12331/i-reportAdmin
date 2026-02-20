package com.example.incidentreports;

/**
 * Model for a PocketBase incident_reports record.
 */
public class IncidentReport {
    private final String id;
    private final String collectionId;
    private final String type;
    private final String description;
    private final String status;
    private final String created;
    private final String latitude;
    private final String longitude;
    private final String address;
    private final String imageFileName;

    public IncidentReport(String id,
                          String collectionId,
                          String type,
                          String description,
                          String status,
                          String created,
                          String latitude,
                          String longitude,
                          String address,
                          String imageFileName) {
        this.id = id;
        this.collectionId = collectionId;
        this.type = type;
        this.description = description;
        this.status = status;
        this.created = created;
        this.latitude = latitude;
        this.longitude = longitude;
        this.address = address;
        this.imageFileName = imageFileName;
    }

    public String getId() {
        return id;
    }

    public String getCollectionId() {
        return collectionId;
    }

    public String getType() {
        return type;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public String getCreated() {
        return created;
    }

    public String getLatitude() {
        return latitude;
    }

    public String getLongitude() {
        return longitude;
    }

    public String getAddress() {
        return address;
    }

    public String getImageFileName() {
        return imageFileName;
    }

    public boolean hasImage() {
        return imageFileName != null && !imageFileName.isEmpty();
    }
}
