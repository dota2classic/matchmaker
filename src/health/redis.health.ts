import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HealthIndicatorService } from "@nestjs/terminus";
import Redis from "ioredis";
import { getRedisTransportOptions } from "@/config/redis.config";

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private readonly redis: Redis;

  constructor(
    private readonly health: HealthIndicatorService,
    config: ConfigService,
  ) {
    this.redis = new Redis({
      ...getRedisTransportOptions(config).options,
      enableOfflineQueue: false,
      commandTimeout: 1000,
    });
    this.redis.on("error", (e) => this.logger.error(e));
  }

  async isHealthy(key: string) {
    const indicator = this.health.check(key);
    try {
      await this.redis.ping();
      return indicator.up();
    } catch (e) {
      return indicator.down(String(e));
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
