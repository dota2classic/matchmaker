import { Injectable } from "@nestjs/common";
import * as client from "prom-client";
import { Gauge, PrometheusContentType, Summary } from "prom-client";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric("d2c_avg_diff") private readonly df: Gauge<string>,
    @InjectMetric("d2c_queue_time") private readonly queueTime: Summary<string>,
    @InjectMetric("d2c_queue_leave_time")
    private readonly queueLeaveTime: Summary<string>,
    private readonly pushgateway: client.Pushgateway<PrometheusContentType>,
  ) {}

  public recordAvgDifference(mode: MatchmakingMode, diff: number) {
    this.df.labels(mode.toString()).set(diff);
  }

  public recordQueueTime(lobbyType: MatchmakingMode, timeInQueue: number) {
    this.queueTime.labels(lobbyType.toString()).observe(timeInQueue);
  }

  public recordLeaveQueue(mode: MatchmakingMode, duration: number) {
    console.log("Record leave queue time", duration);
    this.queueLeaveTime.labels(mode.toString()).observe(duration);
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  private async pushMetrics() {
    await this.pushgateway.push({
      jobName: "game-coordinator",
    });
  }

  @Cron(CronExpression.EVERY_WEEKEND)
  private clearMetrics() {
    this.df.reset();
  }
}
