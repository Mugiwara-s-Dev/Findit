package com.mugidev.FindIt.catalog.dto;

import java.math.BigDecimal;

public record InventoryItemResponse(
        Long inventoryItemId,
        Long productId,
        String productName,
        String brandName,
        String category,
        String unit,
        String barcode,
        BigDecimal price,
        int quantityAvailable,
        Double qualityScore,
        String imageDataUrl
) {
}
