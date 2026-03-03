# Multi-stage build para optimizar tamaño de imagen
# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm@8.10.0

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias (incluyendo devDependencies para build)
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY . .

# Build de la aplicación frontend (Vite)
RUN pnpm run build

# Stage 2: Runtime stage (imagen final optimizada)
FROM node:18-alpine

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

# Instalar pnpm y FFmpeg (necesario para procesamiento de video)
RUN npm install -g pnpm@8.10.0 && \
    apk add --no-cache ffmpeg

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar solo dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# Copiar código fuente (excepto lo que está en .dockerignore)
COPY src ./src
COPY public ./public
COPY database ./database
COPY scripts ./scripts
COPY systemd ./systemd

# Copiar build de Vite desde el stage anterior
COPY --from=builder /app/dist ./dist

# Crear directorios necesarios para volúmenes
RUN mkdir -p /app/uploads /app/data

# Exponer puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/status', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3001

# Comando de inicio
CMD ["node", "-r", "tsx", "src/server/index.ts"]
