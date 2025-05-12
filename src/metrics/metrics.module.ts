import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  makeGaugeProvider,
  makeSummaryProvider,
  PrometheusModule,
  PrometheusUseFactoryOptions,
} from "@willsoto/nestjs-prometheus";
import { MetricsService } from "@/metrics/metrics.service";

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
      inject: [ConfigService],
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
    makeSummaryProvider({
      name: "d2c_queue_time",
      help: "123",
      labelNames: ["mode"],
      aggregator: "average",
      percentiles: [0.01, 0.1, 0.5, 0.9, 0.99],
    }),
    makeSummaryProvider({
      name: "d2c_queue_leave_time",
      help: "123",
      labelNames: ["mode"],
      aggregator: "average",
      percentiles: [0.01, 0.1, 0.5, 0.9, 0.99],
    }),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
