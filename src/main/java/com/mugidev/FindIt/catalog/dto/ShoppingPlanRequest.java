package com.mugidev.FindIt.catalog.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ShoppingPlanRequest(
        @NotNull Double userLatitude,
        @NotNull Double userLongitude,
        @DecimalMin("0.1") Double maxDistanceKm,
        @NotEmpty @Size(max = 12) List<@Valid ShoppingListItemRequest> items
) {
}
