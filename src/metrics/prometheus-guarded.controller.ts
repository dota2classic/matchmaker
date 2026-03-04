import { PrometheusController } from "@willsoto/nestjs-prometheus";
import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { ApiExcludeController } from "@nestjs/swagger";

@ApiExcludeController()
@Controller("/api/v1/metrics")
export class PrometheusGuardedController extends PrometheusController {
  @Get()
  index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
