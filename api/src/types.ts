export type AppEnv = {
  Bindings: Env & { AUTH_SECRET: string }
  Variables: {
    userId: string
  }
}
