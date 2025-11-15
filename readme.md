# Naagostone

A FFXIV Lodestone crawler in TypeScript based on
[lodestone-css-selectors](https://github.com/xivapi/lodestone-css-selectors). It has custom edits and support for
lodestone news. I also include "markdown" versions of crawled texts that are ready to be used within Discord.

### Building the Docker Image

```bash
docker build -t naagostone .
```

### Running with Docker

```bash
docker run -d -p 3001:3001 --name naagostone-api naagostone
```

### Running with Docker Compose

The easiest way to run the service:

```bash
docker compose up -d
```

To stop the service:

```bash
docker compose down
```

### Environment Variables

- `PORT` - Port to run the server on (default: 3001)
- `SERVER_HOST` - Hostname to bind to (default: 127.0.0.1 for local, 0.0.0.0 in Docker)

Example:

```bash
docker run -d -p 3001:3001 -e PORT=3001 -e SERVER_HOST=0.0.0.0 --name naagostone-api naagostone
```

### Container Networking

The service binds to `0.0.0.0` by default, making it accessible from other containers on the same Docker network. When
using docker compose, containers can reach this service at `http://naagostone:3001` (using the service name as
hostname).

### Local Development

For local development without Docker:

```bash
deno task start
```

Or with watch mode:

```bash
deno task dev
```
