import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from "@nestjs/terminus";
import { RedisHealthIndicator } from "./redis.health";
import { RabbitMQHealthIndicator } from "./rabbitmq.health";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly rabbitmq: RabbitMQHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck("postgres"),
      () => this.redis.isHealthy("redis"),
      () => this.rabbitmq.isHealthy("rabbitmq"),
    ]);
  }
}
