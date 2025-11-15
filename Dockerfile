FROM denoland/deno:2.5.6

ARG GIT_COMMIT_HASH=unknown

WORKDIR /app

COPY deno.json deno.lock ./

COPY src ./src
COPY lib ./lib

RUN deno cache src/server.ts

EXPOSE 3001

ENV SERVER_HOST=0.0.0.0

LABEL org.opencontainers.image.source="https://github.com/tancred/naagostone"
LABEL org.opencontainers.image.description="Naagostone - FFXIV Lodestone API"
LABEL org.opencontainers.image.revision="${GIT_COMMIT_HASH}"

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-sys", "--allow-read", "src/server.ts"]

