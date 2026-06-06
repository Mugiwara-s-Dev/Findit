package com.mugidev.FindIt.catalog.dto;

import java.math.BigDecimal;

public record ShoppingStopItemResponse(
        String requestId,
        String productQuery,
        Long inventoryItemId,
        String productName,
        String brandName,
        BigDecimal price,
        String unit
) {
}
