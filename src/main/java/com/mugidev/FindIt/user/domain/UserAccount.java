// Entidad JPA que representa una cuenta de usuario.
package com.mugidev.FindIt.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_accounts")
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @Column(nullable = false)
    private Double preferredLatitude;

    @Column(nullable = false)
    private Double preferredLongitude;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    protected UserAccount() {
    }

    public UserAccount(String fullName, String email, String passwordHash, UserRole role,
                       Double preferredLatitude, Double preferredLongitude) {
        this.fullName = fullName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.preferredLatitude = preferredLatitude;
        this.preferredLongitude = preferredLongitude;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public UserRole getRole() {
        return role;
    }

    public Double getPreferredLatitude() {
        return preferredLatitude;
    }

    public Double getPreferredLongitude() {
        return preferredLongitude;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void refreshProfile(String fullName, String email) {
        this.fullName = fullName;
        this.email = email;
    }

    public void promoteToStoreOwner() {
        if (role == UserRole.CUSTOMER) {
            this.role = UserRole.STORE_OWNER;
        }
    }

    public void refreshSeedProfile(String fullName,
                                   String email,
                                   UserRole role,
                                   Double preferredLatitude,
                                   Double preferredLongitude) {
        this.fullName = fullName;
        this.email = email;
        this.role = role;
        this.preferredLatitude = preferredLatitude;
        this.preferredLongitude = preferredLongitude;
    }
}
