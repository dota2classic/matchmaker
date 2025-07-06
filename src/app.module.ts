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
import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";

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
    RabbitMQModule.forRootAsync({
      useFactory(config: ConfigService): RabbitMQConfig {
        return {
          exchanges: [
            {
              name: "app.events",
              type: "topic",
            },
          ],
          enableControllerDiscovery: true,
          uri: `amqp://${config.get("rabbitmq.user")}:${config.get("rabbitmq.password")}@${config.get("rabbitmq.host")}:${config.get("rabbitmq.port")}`,
        };
      },
      imports: [],
      inject: [ConfigService],
    }),
    MetricsModule,
  ],
  controllers: [],
  providers: [PublishService],
})
export class AppModule {}
