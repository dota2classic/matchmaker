import { ConfigurableModuleAsyncOptions, DynamicModule } from "@nestjs/common";

declare module "@golevelup/nestjs-rabbitmq" {
  type RabbitMQModule = unknown;

  namespace RabbitMQModule {
    function forRootAsync(
      options: ConfigurableModuleAsyncOptions<any>,
    ): DynamicModule;
  }
}
