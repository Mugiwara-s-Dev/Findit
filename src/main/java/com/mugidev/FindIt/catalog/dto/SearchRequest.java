package com.mugidev.FindIt.catalog.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SearchRequest(
        @NotBlank String productQuery,
        @NotNull Double userLatitude,
        @NotNull Double userLongitude,
        @DecimalMin("0.1") Double maxDistanceKm,
        SortBy sortBy,
        @DecimalMin("0.0") @DecimalMax("1.0") Double priceWeight,
        @DecimalMin("0.0") @DecimalMax("1.0") Double qualityWeight,
        @DecimalMin("0.0") @DecimalMax("1.0") Double distanceWeight
) {
    public enum SortBy {
        BEST_MATCH,
        LOWEST_PRICE,
        HIGHEST_QUALITY,
        NEAREST
    }
}
