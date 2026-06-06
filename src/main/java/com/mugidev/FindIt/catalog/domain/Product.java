package com.mugidev.FindIt.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 120)
    private String brandName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductCategory category;

    @Column(nullable = false)
    private String unit;

    protected Product() {
    }

    public Product(String name, ProductCategory category, String unit) {
        this(name, null, category, unit);
    }

    public Product(String name, String brandName, ProductCategory category, String unit) {
        this.name = name;
        this.brandName = normalizeBrandName(brandName);
        this.category = category;
        this.unit = unit;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getBrandName() {
        return brandName;
    }

    public ProductCategory getCategory() {
        return category;
    }

    public String getUnit() {
        return unit;
    }

    private static String normalizeBrandName(String brandName) {
        if (brandName == null) {
            return null;
        }

        String trimmed = brandName.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
