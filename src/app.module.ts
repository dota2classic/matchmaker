import { Module } from "@nestjs/common";
import { PublishService } from "./publish.service";
import { MatchmakerModule } from "./matchmaker/matchmaker.module";
import configuration from "./config/configuration";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { CqrsModule } from "@nestjs/cqrs";
import { ScheduleModule } from "@nestjs/schedule";
import { ClientsModule, RedisOptions, Transport } from "@nestjs/microservices";
import { outerQueryNew } from "@/util/outerQuery";
import { GetPlayerInfoQuery } from "@/gateway/queries/GetPlayerInfo/get-player-info.query";
import { GetSessionByUserQuery } from "@/gateway/queries/GetSessionByUser/get-session-by-user.query";
import { MetricsModule } from "./metrics/metrics.module";
import { getTypeormConfig } from "@/config/typeorm.config";

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
    outerQueryNew(GetPlayerInfoQuery, "RedisQueue"),
    outerQueryNew(GetSessionByUserQuery, "RedisQueue"),
  ],
})
export class AppModule {}
