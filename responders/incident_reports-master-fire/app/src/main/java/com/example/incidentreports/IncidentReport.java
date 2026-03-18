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
    private final String videoFileName;
    private final String reporterName;
    private final String reporterContact;
    private final String reporterId;

    public IncidentReport(String id,
                          String collectionId,
                          String type,
                          String description,
                          String status,
                          String created,
                          String latitude,
                          String longitude,
                          String address,
                          String imageFileName,
                          String videoFileName,
                          String reporterName,
                          String reporterContact,
                          String reporterId) {
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
        this.videoFileName = videoFileName;
        this.reporterName = reporterName;
        this.reporterContact = reporterContact;
        this.reporterId = reporterId;
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

    public String getVideoFileName() {
        return videoFileName;
    }

    public String getReporterName() {
        return reporterName;
    }

    public String getReporterContact() {
        return reporterContact;
    }

    public String getReporterId() {
        return reporterId;
    }

    public boolean hasImage() {
        return imageFileName != null && !imageFileName.isEmpty();
    }

    public boolean hasVideo() {
        return videoFileName != null && !videoFileName.isEmpty();
    }
}
