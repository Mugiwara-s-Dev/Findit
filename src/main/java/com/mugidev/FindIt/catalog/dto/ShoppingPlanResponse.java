package com.mugidev.FindIt.catalog.dto;

import java.math.BigDecimal;
import java.util.List;

public record ShoppingPlanResponse(
        List<ShoppingPlanItemResponse> items,
        List<ShoppingStopResponse> suggestedStops,
        BigDecimal estimatedTotal,
        double estimatedDistanceKm,
        int coveredItems,
        int missingItems
) {
}
