@echo off
setlocal

cd /d "%~dp0"

set "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/findit"
set "SPRING_DATASOURCE_USERNAME=findit"
set "SPRING_DATASOURCE_PASSWORD=findit123"
set "FRONTEND_URL=http://localhost:3000"

echo Starting FindIt backend with Docker PostgreSQL on localhost:5433...
mvn spring-boot:run

endlocal
