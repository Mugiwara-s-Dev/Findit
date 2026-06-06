package com.mugidev.FindIt.catalog.dto;

import java.math.BigDecimal;

public record InventoryOptionResponse(
        Long storeId,
        String storeName,
        String productName,
        String brandName,
        BigDecimal price,
        String unit,
        int quantityAvailable,
        Double qualityScore,
        double storeReputationScore,
        double distanceKm,
        double recommendationScore
) {
}
