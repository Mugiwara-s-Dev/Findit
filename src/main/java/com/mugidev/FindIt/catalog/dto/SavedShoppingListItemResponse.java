package com.mugidev.FindIt.catalog.dto;

public record SavedShoppingListItemResponse(
        Long id,
        int itemOrder,
        String productQuery
) {
}
