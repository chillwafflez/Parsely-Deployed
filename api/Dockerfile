# syntax=docker/dockerfile:1
# Build stage: full .NET 10 SDK to restore + publish.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj first so `dotnet restore` is cached when only source files change.
COPY DocParsing.Api.csproj ./
RUN dotnet restore

# Copy the rest of the source and publish a framework-dependent build.
# UseAppHost=false skips the platform-specific exe shim (~10 MB smaller).
COPY . .
RUN dotnet publish -c Release -o /app /p:UseAppHost=false

# Runtime stage: ASP.NET Core 10 base image. Ships pre-configured with
# APP_UID=1654 (non-root user `app`) and ASPNETCORE_HTTP_PORTS=8080.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "DocParsing.Api.dll"]
