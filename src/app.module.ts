import { Module } from "@nestjs/common";
import { PublishService } from "./publish.service";
import { MatchmakerModule } from "./matchmaker/matchmaker.module";
import configuration from "./config/configuration";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { CqrsModule } from "@nestjs/cqrs";
import { ScheduleModule } from "@nestjs/schedule";
import {
  ClientsModule,
  RedisOptions,
  RmqOptions,
  Transport,
} from "@nestjs/microservices";
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
      {
        name: "RMQ",
        useFactory(config: ConfigService): RmqOptions {
          return {
            transport: Transport.RMQ,
            options: {
              urls: [
                {
                  hostname: config.get<string>("rabbitmq.host"),
                  port: config.get<number>("rabbitmq.port"),
                  protocol: "amqp",
                  username: config.get<string>("rabbitmq.user"),
                  password: config.get<string>("rabbitmq.password"),
                },
              ],
              queue: config.get<string>("rabbitmq.matchmaker_events"),
              queueOptions: {
                durable: true,
              },
              prefetchCount: 5,
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
  providers: [PublishService],
})
export class AppModule {}
