package com.mugidev.FindIt.catalog.dto;

import java.math.BigDecimal;

public record ShoppingOptionResponse(
        Long inventoryItemId,
        Long storeId,
        String storeName,
        String storeAddress,
        double storeLatitude,
        double storeLongitude,
        String productName,
        String brandName,
        BigDecimal price,
        String unit,
        Double qualityScore,
        double storeReputationScore,
        double distanceKm,
        double recommendationScore,
        String imageDataUrl
) {
}
