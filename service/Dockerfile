# syntax=docker/dockerfile:1
# =============================================================================
#  DanNest API — multi-stage Docker build
#
#  Stage 1 (build) uses the full JDK + Gradle to compile a runnable jar.
#  Stage 2 (run)   uses a small JRE and runs ONLY that jar.
#  Result: a lean, production-ready image with no build tools inside.
# =============================================================================


# ------------------------------- Stage 1: build ------------------------------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Copy the Gradle wrapper + build scripts FIRST so Docker can cache the
# dependency layer. It's only invalidated when these files change — editing
# source code alone won't re-download dependencies.
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew

# Copy the source, then compile + package into a Spring Boot "fat jar"
# (application + all dependencies bundled into one runnable .jar).
COPY src ./src
RUN ./gradlew clean bootJar --no-daemon


# -------------------------------- Stage 2: run -------------------------------
FROM eclipse-temurin:21-jre AS run
WORKDIR /app

# Pull ONLY the built jar out of the build stage; everything else (JDK, Gradle,
# source) is left behind, keeping this final image small.
COPY --from=build /app/build/libs/*.jar app.jar

# Documents the default port (informational).
EXPOSE 8090

# Start command. Binds to $PORT when the host provides one (Render does),
# otherwise falls back to 8090 for local runs. `sh -c` enables the ${...:-} shell
# default-value substitution.
ENTRYPOINT ["sh", "-c", "java -jar app.jar --server.port=${PORT:-8090}"]
