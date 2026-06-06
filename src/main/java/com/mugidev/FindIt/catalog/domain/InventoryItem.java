package com.mugidev.FindIt.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "inventory_items")
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private int quantityAvailable;

    private Double qualityScore;

    @Column(length = 64)
    private String barcode;

    @Column(columnDefinition = "text")
    private String imageDataUrl;

    protected InventoryItem() {
    }

    public InventoryItem(Product product, BigDecimal price, int quantityAvailable, Double qualityScore) {
        this(product, price, quantityAvailable, qualityScore, null, null);
    }

    public InventoryItem(Product product,
                         BigDecimal price,
                         int quantityAvailable,
                         Double qualityScore,
                         String barcode,
                         String imageDataUrl) {
        this.product = product;
        this.price = price;
        this.quantityAvailable = quantityAvailable;
        this.qualityScore = qualityScore;
        this.barcode = barcode;
        this.imageDataUrl = imageDataUrl;
    }

    public void updateListing(Product product,
                              BigDecimal price,
                              int quantityAvailable,
                              String barcode,
                              String imageDataUrl) {
        this.product = product;
        this.price = price;
        this.quantityAvailable = quantityAvailable;
        this.barcode = barcode;
        this.imageDataUrl = imageDataUrl;
    }

    void assignStore(Store store) {
        this.store = store;
    }

    public Long getId() {
        return id;
    }

    public Store getStore() {
        return store;
    }

    public Product getProduct() {
        return product;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public int getQuantityAvailable() {
        return quantityAvailable;
    }

    public Double getQualityScore() {
        return qualityScore;
    }

    public String getBarcode() {
        return barcode;
    }

    public String getImageDataUrl() {
        return imageDataUrl;
    }
}
