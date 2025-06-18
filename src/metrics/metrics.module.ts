import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeSummaryProvider,
  PrometheusModule,
  PrometheusUseFactoryOptions,
} from "@willsoto/nestjs-prometheus";
import { MetricsService } from "@/metrics/metrics.service";
import { PrometheusBasicAuthStrategy } from "@/metrics/prometheus-basic-auth.strategy";
import { PrometheusGuardedController } from "@/metrics/prometheus-guarded.controller";

@Global()
@Module({
  imports: [
    PrometheusModule.registerAsync({
      useFactory(config: ConfigService): PrometheusUseFactoryOptions {
        return {
          pushgateway: {
            url: config.get("pushgateway_url")!,
          },
        };
      },
      global: true,
      imports: [],
      controller: PrometheusGuardedController,
      inject: [ConfigService],
    }),
  ],
  providers: [
    MetricsService,
    PrometheusBasicAuthStrategy,
    makeGaugeProvider({
      name: "d2c_avg_diff",
      help: "123",
      labelNames: ["mode"],
      aggregator: "average",
    }),
    makeGaugeProvider({
      name: "d2c_queue_length",
      help: "123",
      labelNames: ["mode"],
    }),
    makeCounterProvider({
      name: "d2c_queue_entered_total",
      help: "123",
      labelNames: ["mode"],
    }),
    makeCounterProvider({
      name: "d2c_queue_left_total",
      help: "123",
      labelNames: ["mode"],
    }),
    makeSummaryProvider({
      name: "d2c_queue_time",
      help: "123",
      labelNames: ["mode", "hour"],
      percentiles: [0.01, 0.1, 0.5, 0.9, 0.99],
    }),
    makeSummaryProvider({
      name: "d2c_queue_leave_time",
      help: "123",
      labelNames: ["mode", "hour"],
      percentiles: [0.01, 0.1, 0.5, 0.9, 0.99],
    }),
  ],
  controllers: [PrometheusGuardedController],
  exports: [MetricsService],
})
export class MetricsModule {}
