package com.mugidev.FindIt.catalog.dto;

import com.mugidev.FindIt.catalog.domain.StoreCategory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateStoreRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull StoreCategory category,
        @NotNull Double latitude,
        @NotNull Double longitude,
        @NotNull @Size(max = 6) List<@Valid StorePhotoRequest> photos
) {
}
