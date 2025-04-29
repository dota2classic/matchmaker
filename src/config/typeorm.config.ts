import { ConfigService } from "@nestjs/config";
import configuration from "@/config/configuration";
import { DataSource } from "typeorm";
import Entities from "@/matchmaker/entity";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

export const getTypeormConfig = (
  cs: ConfigService,
): PostgresConnectionOptions => {
  return {
    type: "postgres",
    database: "postgres",

    port: cs.get<number>("postgres.port") || 5432,
    host: cs.get("postgres.host"),
    username: cs.get("postgres.username"),
    password: cs.get("postgres.password"),
    synchronize: false,
    entities: Entities,
    migrations: ["src/database/migrations/*.*"],
    migrationsRun: false,
    logging: true,
  };
};

const AppDataSource = new DataSource(
  getTypeormConfig(new ConfigService(configuration("config.yaml"))),
);

export default AppDataSource;
