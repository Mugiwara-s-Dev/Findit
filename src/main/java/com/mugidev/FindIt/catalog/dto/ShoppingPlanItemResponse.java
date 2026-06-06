package com.mugidev.FindIt.catalog.dto;

import java.util.List;

public record ShoppingPlanItemResponse(
        String requestId,
        String productQuery,
        Long selectedInventoryItemId,
        List<ShoppingOptionResponse> options
) {
}
