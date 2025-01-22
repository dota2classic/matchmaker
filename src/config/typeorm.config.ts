import { ConfigService } from "@nestjs/config";
import configuration from "@/config/configuration";
import { DataSource } from "typeorm";
import Entities from "@/matchmaker/entity";

const configService = new ConfigService(configuration("prod.config.yaml"));

const AppDataSource = new DataSource({
  type: "postgres",

  port: 5432,
  host: configService.get("postgres.host"),
  username: configService.get("postgres.username"),
  password: configService.get("postgres.password"),
  synchronize: false,
  entities: Entities,
  migrations: ["src/database/migrations/*.*"],
  migrationsRun: false,
  logging: true,
});

export default AppDataSource;
