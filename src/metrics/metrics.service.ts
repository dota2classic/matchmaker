import { Injectable } from "@nestjs/common";
import * as client from "prom-client";
import { Gauge, PrometheusContentType } from "prom-client";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric("d2c_avg_diff") private readonly df: Gauge<string>,
    @InjectMetric("d2c_queue_time") private readonly queueTime: Gauge<string>,
    private readonly pushgateway: client.Pushgateway<PrometheusContentType>,
  ) {}

  public recordAvgDifference(mode: MatchmakingMode, diff: number) {
    this.df.labels(mode.toString()).set(diff);
  }

  public recordQueueTime(lobbyType: MatchmakingMode, timeInQueue: number) {
    this.queueTime.labels(lobbyType.toString()).set(timeInQueue);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async pushMetrics() {
    await this.pushgateway.pushAdd({
      jobName: "game-coordinator",
    });
  }

  @Cron(CronExpression.EVERY_WEEKEND)
  private clearMetrics() {
    this.df.reset();
  }
}
