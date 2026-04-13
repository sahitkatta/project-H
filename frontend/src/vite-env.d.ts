/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FORM_TEST_PREFILL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
