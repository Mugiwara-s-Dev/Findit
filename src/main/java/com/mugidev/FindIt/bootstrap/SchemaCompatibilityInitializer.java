// corrige compatibilidades del esquema al arrancar

// Ajusta compatibilidad del esquema al arrancar la aplicacion.
package com.mugidev.FindIt.bootstrap;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.SQLException;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.util.List;

@Component
@Order(0)
public class SchemaCompatibilityInitializer implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public SchemaCompatibilityInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            if (isColumnNonNullable(connection.getMetaData(), "inventory_items", "quality_score")
                    || isColumnNonNullable(connection.getMetaData(), "INVENTORY_ITEMS", "QUALITY_SCORE")) {
                jdbcTemplate.execute("alter table inventory_items alter column quality_score drop not null");
            }

            if ("PostgreSQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName())) {
                dropLegacyProductNameConstraint();
            }

            return null;
        });
    }

    private void dropLegacyProductNameConstraint() {
        List<String> constraintNames = jdbcTemplate.queryForList("""
                select tc.constraint_name
                from information_schema.table_constraints tc
                join information_schema.constraint_column_usage ccu
                  on tc.constraint_schema = ccu.constraint_schema
                 and tc.constraint_name = ccu.constraint_name
                where tc.table_name = 'products'
                  and tc.constraint_type = 'UNIQUE'
                  and ccu.column_name = 'name'
                """, String.class);

        for (String constraintName : constraintNames) {
            jdbcTemplate.execute("alter table products drop constraint if exists " + constraintName);
        }
    }

    private boolean isColumnNonNullable(DatabaseMetaData metadata, String tableName, String columnName) throws SQLException {
        try (ResultSet columns = metadata.getColumns(null, null, tableName, columnName)) {
            return columns.next() && columns.getInt("NULLABLE") == DatabaseMetaData.columnNoNulls;
        }
    }
}
