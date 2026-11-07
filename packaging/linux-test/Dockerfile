# Alleen de CI-testomgeving; de SuperCloud bouwt het gezamenlijke OpenAEC Linux-image zelf.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates labwc grim wtype nodejs procps libwebkit2gtk-4.1-0 \
    libayatana-appindicator3-1 librsvg2-2 libegl1 libgl1-mesa-dri libgles2 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home openaec
USER 10001:10001
WORKDIR /tmp
ENTRYPOINT ["bash", "/src/scripts/check-openaec-linux.sh"]
