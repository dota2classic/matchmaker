import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  makeGaugeProvider,
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
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
