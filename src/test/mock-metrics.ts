import { MetricsService } from "@/metrics/metrics.service";
import { Module } from "@nestjs/common";

@Module({
  providers: [MetricsService],
  imports: [],
})
export class MockMetricsModule {}
