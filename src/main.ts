import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RedisOptions, Transport } from "@nestjs/microservices";
import configuration from "@/config/configuration";
import { ConfigService } from "@nestjs/config";
import { WinstonWrapper } from "@/util/logger";

async function bootstrap() {
  const config = new ConfigService(configuration());

  const app = await NestFactory.create(AppModule, {
    logger: new WinstonWrapper(
      config.get("fluentbit.host")!,
      config.get("fluentbit.port")!,
      config.get<boolean>("fluentbit.disabled"),
    ),
  });

  app.connectMicroservice<RedisOptions>({
    transport: Transport.REDIS,
    options: {
      retryAttempts: 3,
      retryDelay: 3000,
      password: config.get("redis.password"),
      host: config.get("redis.host"),
    },
  });

  await app.listen(7777);
}
bootstrap();
