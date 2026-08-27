/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
    const type = e.record.get("type");
    const latStr = e.record.get("latitude");
    const lonStr = e.record.get("longitude");
    
    if (!latStr || !lonStr) return e.next();

    const lat1 = parseFloat(latStr);
    const lon1 = parseFloat(lonStr);

    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const p1 = lat1 * Math.PI/180;
        const p2 = lat2 * Math.PI/180;
        const dp = (lat2-lat1) * Math.PI/180;
        const dl = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(dp/2) * Math.sin(dp/2) +
                Math.cos(p1) * Math.cos(p2) *
                Math.sin(dl/2) * Math.sin(dl/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    const lockKey = "dedup_" + type + "_" + lat1.toFixed(4) + "_" + lon1.toFixed(4);

    try {
        if (e.app.store().has(lockKey)) {
            throw new BadRequestError("Duplicate incident report! Another user just reported this.");
        }
        
        e.app.store().set(lockKey, 1);
        
        

        const existingRecords = e.app.findRecordsByFilter(
            "incident_reports",
            "(status = 'new' || status = 'pending') && type = {:type}",
            "-created",
            50,
            0,
            { type: type }
        );

        for (let i = 0; i < existingRecords.length; i++) {
            const existing = existingRecords[i];
            const lat2 = parseFloat(existing.get("latitude"));
            const lon2 = parseFloat(existing.get("longitude"));
            
            const dist = getDistance(lat1, lon1, lat2, lon2);
            
            if (dist <= 100) {
                let currentCount = existing.getInt("reporters_count");
                if (!currentCount) currentCount = 0;
                
                existing.set("reporters_count", currentCount + 1);
                e.app.save(existing);
                
                throw new BadRequestError("Duplicate incident report! Another user just reported this.");
            }
        }
        
        const result = e.next();
        e.app.store().remove(lockKey);
        return result;

    } catch (err) {
        e.app.store().remove(lockKey);
        if (err.message && err.message.includes("Duplicate incident")) {
            throw err;
        }
        console.log("Spatial dedup error:", err);
    }
    
    return e.next();
}, "incident_reports");

