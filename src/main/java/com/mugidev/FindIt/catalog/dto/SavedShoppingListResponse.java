package com.mugidev.FindIt.catalog.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SavedShoppingListResponse(
        Long id,
        String name,
        List<SavedShoppingListItemResponse> items,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
