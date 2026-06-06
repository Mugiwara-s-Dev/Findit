package com.mugidev.FindIt.catalog.dto;

import com.mugidev.FindIt.catalog.domain.StoreCategory;

public record StoreSummaryResponse(
        Long id,
        String name,
        StoreCategory category,
        String address,
        double latitude,
        double longitude,
        double reputationScore,
        Double distanceKm,
        String ownerDisplayName,
        boolean canManage
) {
}
