FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace

COPY backend/ ./backend/
COPY api-gateway/ ./api-gateway/

RUN mvn -B -f backend/pom.xml clean install -DskipTests

RUN mvn -B -f api-gateway/pom.xml clean package -DskipTests

RUN mkdir -p /artifacts \
    && find api-gateway/target \
       -maxdepth 1 \
       -type f \
       -name "*.jar" \
       ! -name "*sources*" \
       ! -name "*javadoc*" \
       -exec cp {} /artifacts/api.jar \;


FROM eclipse-temurin:17-jre-jammy AS runtime

WORKDIR /app

COPY --from=build /workspace/backend/master/target/classes/ ./master/
COPY --from=build /workspace/backend/storage-node/target/classes/ ./storage-node/
COPY --from=build /workspace/backend/common/target/classes/ ./common/

COPY --from=build /artifacts/api.jar ./api.jar

RUN mkdir -p data/master \
    data/node-01 \
    data/node-02 \
    data/node-03 \
    data/security

EXPOSE 1099 5001 5002 5003 8080

CMD ["java", "-cp", "master:common", "com.nexuscloud.master.MasterServer"]