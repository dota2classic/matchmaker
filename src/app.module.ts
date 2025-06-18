import { Module } from "@nestjs/common";
import { PublishService } from "./publish.service";
import { MatchmakerModule } from "./matchmaker/matchmaker.module";
import configuration from "./config/configuration";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { CqrsModule } from "@nestjs/cqrs";
import { ScheduleModule } from "@nestjs/schedule";
import { ClientsModule, RedisOptions, Transport } from "@nestjs/microservices";
import { MetricsModule } from "./metrics/metrics.module";
import { getTypeormConfig } from "@/config/typeorm.config";
import { Configuration, PlayerApi } from "@/generated-api/gameserver";

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
          ...getTypeormConfig(config),
          type: "postgres",
          migrations: ["dist/src/database/migrations/*.*"],
          migrationsRun: true,
          logging: undefined,
        };
      },
      imports: [],
      inject: [ConfigService],
    }),
    MatchmakerModule,
    ScheduleModule.forRoot(),
    ClientsModule.registerAsync([
      {
        name: "RedisQueue",
        useFactory(config: ConfigService): RedisOptions {
          return {
            transport: Transport.REDIS,
            options: {
              host: config.get("redis.host"),
              password: config.get("redis.password"),
            },
          };
        },
        inject: [ConfigService],
        imports: [],
      },
    ]),
    MetricsModule,
  ],
  controllers: [],
  providers: [
    PublishService,
    {
      provide: PlayerApi,
      useFactory: (config: ConfigService) => {
        return new PlayerApi(
          new Configuration({ basePath: config.get("gameserverUrl") }),
        );
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
