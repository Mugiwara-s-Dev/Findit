package com.mugidev.FindIt.bootstrap;

import com.mugidev.FindIt.catalog.domain.InventoryItem;
import com.mugidev.FindIt.catalog.domain.Product;
import com.mugidev.FindIt.catalog.domain.ProductCategory;
import com.mugidev.FindIt.catalog.domain.Store;
import com.mugidev.FindIt.catalog.domain.StoreCategory;
import com.mugidev.FindIt.catalog.repository.ProductRepository;
import com.mugidev.FindIt.catalog.repository.StoreRepository;
import com.mugidev.FindIt.shared.security.PasswordHasher;
import com.mugidev.FindIt.user.domain.UserAccount;
import com.mugidev.FindIt.user.domain.UserRole;
import com.mugidev.FindIt.user.repository.UserAccountRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final double DEMO_LATITUDE = 1.23207;
    private static final double DEMO_LONGITUDE = -77.29295;

    private final StoreRepository storeRepository;
    private final ProductRepository productRepository;
    private final UserAccountRepository userAccountRepository;
    private final PasswordHasher passwordHasher;

    public DataSeeder(StoreRepository storeRepository,
                      ProductRepository productRepository,
                      UserAccountRepository userAccountRepository,
                      PasswordHasher passwordHasher) {
        this.storeRepository = storeRepository;
        this.productRepository = productRepository;
        this.userAccountRepository = userAccountRepository;
        this.passwordHasher = passwordHasher;
    }

    @Override
    @Transactional
    public void run(String... args) {
        seedCatalog();
        seedUsers();
    }

    private void seedCatalog() {
        UserAccount storeOwner = upsertUser(
                "Pedro Gomez",
                "pedro@findit.local",
                UserRole.STORE_OWNER,
                1.23540,
                -77.29110
        );

        Product rice = findOrCreateProduct("Arroz Diana 500g", ProductCategory.FOOD, "500 g");
        Product eggs = findOrCreateProduct("Huevos AA x12", ProductCategory.FOOD, "docena");
        Product milk = findOrCreateProduct("Leche Entera 1L", ProductCategory.BEVERAGE, "1 L");
        Product acetaminophen = findOrCreateProduct("Acetaminofen 500mg", ProductCategory.HEALTH, "caja");
        Product dogFood = findOrCreateProduct("Concentrado perro 2kg", ProductCategory.PETS, "2 kg");
        Product detergent = findOrCreateProduct("Detergente 1kg", ProductCategory.HOME, "1 kg");

        upsertStore(
                storeOwner,
                "Tiendita La 14",
                StoreCategory.MINIMARKET,
                "Cra 24 #16-18",
                1.23310,
                -77.29420,
                4.6,
                List.of(
                        inventoryItem(rice, "3200", 35, 4.2),
                        inventoryItem(eggs, "14500", 20, 4.5),
                        inventoryItem(milk, "4200", 40, 4.0)
                )
        );

        upsertStore(
                storeOwner,
                "Mercado Don Pepe",
                StoreCategory.GROCERY,
                "Calle 18 #22-44",
                1.22980,
                -77.28970,
                4.7,
                List.of(
                        inventoryItem(rice, "3000", 22, 4.8),
                        inventoryItem(eggs, "13800", 18, 4.6),
                        inventoryItem(milk, "4350", 25, 4.4)
                )
        );

        upsertStore(
                storeOwner,
                "Drogueria Central",
                StoreCategory.PHARMACY,
                "Av. Panamericana #14-32",
                1.23540,
                -77.29110,
                4.8,
                List.of(inventoryItem(acetaminophen, "6800", 60, 4.9))
        );

        upsertStore(
                storeOwner,
                "Mascotas del Barrio",
                StoreCategory.PET_SHOP,
                "Cra 27 #17-09",
                1.23010,
                -77.29650,
                4.5,
                List.of(inventoryItem(dogFood, "28900", 16, 4.7))
        );

        upsertStore(
                storeOwner,
                "Super Vecino Express",
                StoreCategory.MINIMARKET,
                "Calle 20 #25-14",
                1.23620,
                -77.28790,
                4.4,
                List.of(
                        inventoryItem(rice, "3350", 28, 4.1),
                        inventoryItem(eggs, "14900", 14, 4.2),
                        inventoryItem(milk, "4100", 12, 4.3),
                        inventoryItem(detergent, "7800", 10, 4.0)
                )
        );
    }

    private void seedUsers() {
        upsertUser(
                "Laura Martinez",
                "laura@findit.local",
                UserRole.CUSTOMER,
                DEMO_LATITUDE,
                DEMO_LONGITUDE
        );
        upsertUser(
                "Pedro Gomez",
                "pedro@findit.local",
                UserRole.STORE_OWNER,
                1.23540,
                -77.29110
        );
        upsertUser(
                "Admin FindIt",
                "admin@findit.local",
                UserRole.ADMIN,
                DEMO_LATITUDE,
                DEMO_LONGITUDE
        );
    }

    private Product findOrCreateProduct(String name, ProductCategory category, String unit) {
        return productRepository.findByNameIgnoreCaseAndCategoryAndUnitIgnoreCase(name, category, unit)
                .orElseGet(() -> productRepository.save(new Product(name, category, unit)));
    }

    private void upsertStore(UserAccount owner,
                             String name,
                             StoreCategory category,
                             String address,
                             double latitude,
                             double longitude,
                             double reputationScore,
                             List<InventoryItem> inventoryItems) {
        Store store = storeRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> new Store(owner, name, category, address, latitude, longitude, reputationScore));

        store.assignOwner(owner);
        store.refreshSeedData(name, category, address, latitude, longitude, reputationScore);
        store.replaceInventoryItems(inventoryItems);
        storeRepository.save(store);
    }

    private UserAccount upsertUser(String fullName,
                                   String email,
                                   UserRole role,
                                   double preferredLatitude,
                                   double preferredLongitude) {
        return userAccountRepository.findByEmailIgnoreCase(email)
                .map(existing -> {
                    existing.refreshSeedProfile(fullName, email, role, preferredLatitude, preferredLongitude);
                    return userAccountRepository.save(existing);
                })
                .orElseGet(() -> userAccountRepository.save(new UserAccount(
                        fullName,
                        email,
                        passwordHasher.hash("secret123"),
                        role,
                        preferredLatitude,
                        preferredLongitude
                )));
    }

    private InventoryItem inventoryItem(Product product, String price, int quantityAvailable, double qualityScore) {
        return new InventoryItem(product, new BigDecimal(price), quantityAvailable, qualityScore);
    }
}
