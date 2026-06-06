package com.mugidev.FindIt.catalog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SavedShoppingListItemRequest(
        @NotBlank @Size(max = 120) String productQuery
) {
}
