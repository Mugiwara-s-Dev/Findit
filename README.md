# FindIt local setup

## 1. Levantar la base de datos

```bash
docker compose up -d
```

Esto inicia PostgreSQL con PostGIS en `localhost:5433`.

## 2. Variables de entorno del backend

Puedes usar estas variables:

```bash
DB_URL=jdbc:postgresql://localhost:5433/findit
DB_USERNAME=findit
DB_PASSWORD=findit123
FRONTEND_URL=http://localhost:3000
```

## 3. Ejecutar la API Spring Boot

```bash
mvn spring-boot:run
```

La API quedará disponible en `http://localhost:8080/api/v1`.

Si en tu máquina hay otro PostgreSQL instalado y Spring sigue tomando credenciales viejas, usa este script:

```bash
start-backend.bat
```

## 4. Ejecutar el frontend Next.js

Desde la carpeta `frontend`:

```bash
npm run dev
```

O directamente:

```bash
start-frontend.bat
```

Si quieres definir la URL de la API explícitamente, usa:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

## Estado actual

- El catálogo ya persiste en PostgreSQL mediante JPA.
- Los usuarios también son una entidad persistente.
- El frontend inicial permite buscar productos, comparar tiendas, ver detalle de inventario y crear usuarios.
- Si quieres una ayuda rápida para iniciar todo, ejecuta `start-dev.bat`.
