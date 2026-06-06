package com.mugidev.FindIt.catalog.dto;

import com.mugidev.FindIt.catalog.domain.StoreCategory;

import java.util.List;

public record StoreDetailResponse(
        Long id,
        String name,
        StoreCategory category,
        String address,
        double latitude,
        double longitude,
        double reputationScore,
        String ownerDisplayName,
        boolean canManage,
        List<InventoryItemResponse> inventory,
        List<StorePhotoResponse> photos
) {
}
