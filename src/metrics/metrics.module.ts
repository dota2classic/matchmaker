import { Global, Module } from "@nestjs/common";
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeSummaryProvider,
  PrometheusModule,
} from "@willsoto/nestjs-prometheus";
import { MetricsService } from "@/metrics/metrics.service";

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      global: true,
    }),
  ],
  providers: [
    MetricsService,
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
  exports: [MetricsService],
})
export class MetricsModule {}
