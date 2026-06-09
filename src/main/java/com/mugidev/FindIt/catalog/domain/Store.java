// Entidad JPA que representa una tienda con inventario y fotos.
package com.mugidev.FindIt.catalog.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

import com.mugidev.FindIt.user.domain.UserAccount;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "stores")
public class Store {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StoreCategory category;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(nullable = false)
    private double reputationScore;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private UserAccount owner;

    @OneToMany(mappedBy = "store", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InventoryItem> inventoryItems = new ArrayList<>();

    @OneToMany(mappedBy = "store", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderColumn(name = "photo_order")
    private List<StorePhoto> photos = new ArrayList<>();

    protected Store() {
    }

    public Store(UserAccount owner,
                 String name,
                 StoreCategory category,
                 String address,
                 double latitude,
                 double longitude,
                 double reputationScore) {
        this.owner = owner;
        this.name = name;
        this.category = category;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.reputationScore = reputationScore;
    }

    public void assignOwner(UserAccount owner) {
        this.owner = owner;
    }

    public void addInventoryItem(InventoryItem item) {
        inventoryItems.add(item);
        item.assignStore(this);
    }

    public void replaceInventoryItems(List<InventoryItem> nextInventoryItems) {
        inventoryItems.clear();
        nextInventoryItems.forEach(this::addInventoryItem);
    }

    public void addPhoto(StorePhoto photo) {
        photos.add(photo);
        photo.assignStore(this);
    }

    public void updateDetails(String name, StoreCategory category, String address, double latitude, double longitude) {
        this.name = name;
        this.category = category;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public void refreshSeedData(String name,
                                StoreCategory category,
                                String address,
                                double latitude,
                                double longitude,
                                double reputationScore) {
        this.name = name;
        this.category = category;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.reputationScore = reputationScore;
    }

    public void replacePhotos(List<StorePhoto> nextPhotos) {
        photos.clear();
        nextPhotos.forEach(this::addPhoto);
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public StoreCategory getCategory() {
        return category;
    }

    public String getAddress() {
        return address;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public double getReputationScore() {
        return reputationScore;
    }

    public UserAccount getOwner() {
        return owner;
    }

    public List<InventoryItem> getInventoryItems() {
        return inventoryItems;
    }

    public List<StorePhoto> getPhotos() {
        return photos;
    }
}
