import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { MatchmakerModule } from "./matchmaker/matchmaker.module";
import configuration from "./config/configuration";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import Entities from "@/matchmaker/entity";
import { CqrsModule } from "@nestjs/cqrs";
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    CqrsModule,
    TypeOrmModule.forRootAsync({
      useFactory(config: ConfigService): TypeOrmModuleOptions {
        return {
          type: "postgres",
          database: "postgres",
          host: config.get("postgres.host"),
          port: 5432,
          username: config.get("postgres.username"),
          password: config.get("postgres.password"),
          entities: Entities,
          synchronize: true,

          ssl: false,
        };
      },
      imports: [],
      inject: [ConfigService],
    }),
    MatchmakerModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
