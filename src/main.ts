import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { EventBus } from "@nestjs/cqrs";
import { PlayerEnterQueueRequestedEvent } from "@/gateway/events/mm/player-enter-queue-requested.event";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.startAllMicroservices();

  await app.listen(4343);

  app
    .get(EventBus)
    .publish(
      new PlayerEnterQueueRequestedEvent(Math.random().toString(), [MatchmakingMode.UNRANKED]),
    );
}
bootstrap();
