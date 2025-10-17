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

  fluentbit: {
    application: string;
    host: string;
    port: string;
  };
  rabbitmq: {
    host: string;
    port: string;
    user: string;
    password: string;
  };
}

export default (): ExpectedConfig => {
  return {
    gameserverUrl: process.env.GAMESERVER_API,
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
    rabbitmq: {
      host: process.env.RABBITMQ_HOST,
      port: process.env.RABBITMQ_PORT,
      user: process.env.RABBITMQ_USER,
      password: process.env.RABBITMQ_PASSWORD,
    },
    fluentbit: {
      application: process.env.APP_NAME!,
      host: process.env.FLUENTBIT_HOST!,
      port: process.env.FLUENTBIT_PORT!,
    },
  } as ExpectedConfig;
};
