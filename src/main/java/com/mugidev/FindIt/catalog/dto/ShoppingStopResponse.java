package com.mugidev.FindIt.catalog.dto;

import java.math.BigDecimal;
import java.util.List;

public record ShoppingStopResponse(
        Long storeId,
        String storeName,
        String address,
        double latitude,
        double longitude,
        double distanceFromPreviousKm,
        BigDecimal subtotal,
        List<ShoppingStopItemResponse> products
) {
}
