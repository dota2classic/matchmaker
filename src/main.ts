import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Transport } from "@nestjs/microservices";
import configuration from "@/config/configuration";
import { ConfigService } from "@nestjs/config";

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

  await app.listen();
}
bootstrap();
