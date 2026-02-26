#!/usr/bin/env bash
set -e
COMPOSE_FILE="docker-compose.dev.yml"
CONTAINER="naagostone-api"

case "${1:-}" in
  up)
    docker compose -f "$COMPOSE_FILE" up -d
    ;;
  up:build)
    docker compose -f "$COMPOSE_FILE" up -d --build
    ;;
  down)
    docker compose -f "$COMPOSE_FILE" down
    ;;
  purge)
    docker compose -f "$COMPOSE_FILE" down -v
    ;;
  rebuild)
    docker compose -f "$COMPOSE_FILE" up -d --build naagostone
    ;;
  restart)
    docker compose -f "$COMPOSE_FILE" restart naagostone
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f naagostone
    ;;
  check)
    echo "==> deno fmt"
    docker exec "$CONTAINER" deno fmt
    echo "==> deno lint"
    docker exec "$CONTAINER" deno lint
    echo "==> deno check"
    docker exec "$CONTAINER" deno check src/server.ts
    echo "==> All checks passed"
    ;;
  *)
    echo "Usage: $0 {up|up:build|down|purge|rebuild|restart|logs|check}"
    exit 1
    ;;
esac
