# Build stage
FROM maven:3.6.0-jdk-11-slim AS build

WORKDIR /app/crawler

COPY src ./src
COPY libs ./libs
COPY pom.xml .
RUN mvn --quiet -e -f ./pom.xml clean assembly:assembly

# Package stage

# use the jena image providing java jre and jena tools
FROM stain/jena AS jena-tools

WORKDIR /app/crawler

COPY --from=build /app/crawler/target/cc-lod-crawler-DockerApplication .

RUN chmod 777 /app/crawler
RUN chmod 777 /app/crawler/rdf2edm.sh