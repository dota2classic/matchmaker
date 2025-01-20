import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Transport } from "@nestjs/microservices";
import configuration from "@/config/configuration";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { QueueMeta } from "@/matchmaker/entity/queue-meta";
import { Repository } from "typeorm";
import { Dota2Version } from "@/gateway/shared-types/dota2version";
import { EventBus } from "@nestjs/cqrs";

async function bootstrap() {
  const config = new ConfigService(configuration());

  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.REDIS,
    options: {
      retryAttempts: 3,
      retryDelay: 3000,
      password: config.get("redis.password"),
      host: config.get("redis.host"),
    },
  });

  const ebus: EventBus = app.get(EventBus);
  ebus.subscribe((e) => {
    console.log(e);
  });

  const repo: Repository<QueueMeta> = app.get(getRepositoryToken(QueueMeta));
  await repo.upsert(
    {
      isLocked: false,
      version: Dota2Version.Dota_684,
    },
    ["version"],
  );

  await app.listen();
}
bootstrap();
