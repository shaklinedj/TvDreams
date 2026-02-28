/// <reference types="vite/client" />

// Add any custom VITE_ variables used throughout the project here
interface ImportMetaEnv {
  readonly VITE_PREMIO_WS_URL?: string;
  readonly VITE_CLIENT_HOST?: string;
  readonly VITE_PORT?: string;
  // ...other VITE_ variables
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
