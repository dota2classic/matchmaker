import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from "@nestjs/terminus";
import { Transport } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private config: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // PostgreSQL check
      () => this.db.pingCheck("postgres"),

      // Redis check
      () =>
        this.microservice.pingCheck("redis", {
          transport: Transport.REDIS,
          options: {
            host: this.config.get("redis.host"),
            password: this.config.get("redis.password"),
          },
        }),

      // RabbitMQ check
      () =>
        this.microservice.pingCheck("rabbitmq", {
          transport: Transport.RMQ,
          options: {
            urls: [
              `amqp://${this.config.get("rabbitmq.user")}:${this.config.get("rabbitmq.password")}@${this.config.get("rabbitmq.host")}:${this.config.get("rabbitmq.port")}`,
            ],
          },
        }),
    ]);
  }
}
