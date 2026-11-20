import { Injectable, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { HealthIndicatorService } from "@nestjs/terminus";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";

@Injectable()
export class RabbitMQHealthIndicator implements OnModuleInit {
  private amqp: AmqpConnection;

  constructor(
    private readonly health: HealthIndicatorService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.amqp = this.moduleRef.get(AmqpConnection, { strict: false });
  }

  isHealthy(key: string) {
    const indicator = this.health.check(key);
    return this.amqp.connected
      ? indicator.up()
      : indicator.down("not connected");
  }
}
