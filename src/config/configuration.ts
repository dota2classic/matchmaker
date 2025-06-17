export interface ExpectedConfig {
  redis: {
    host: string;
    password: string;
  };
  postgres: {
    host: string;
    port: number;
    username: string;
    password: string;
  };
}

export default (): ExpectedConfig => {
  return {
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      password: process.env.REDIS_PASSWORD || "",
    },
    postgres: {
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      username: process.env.POSTGRES_USERNAME || "postgres",
      password: process.env.POSTGRES_PASSWORD || "",
    },
  };
};
