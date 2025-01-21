import { performance } from "perf_hooks";
import { Logger } from "@nestjs/common";
import { Constructor, IQuery, IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ClientProxy } from "@nestjs/microservices";
import { timeout } from "rxjs/operators";

export function outerQueryNew<T extends IQuery, B>(
  type: Constructor<T>,
  provide = "RedisQueue",
): any {
  // Small trick to set class.name dynamically, it is needed for nestjs
  const ClassName = `${type.name}Handler`;
  const context = {
    [ClassName]: class implements IQueryHandler<T, B | undefined> {
      private readonly logger = new Logger(ClassName);
      constructor(private readonly redis: ClientProxy) {}

      async execute(query: T): Promise<B | undefined> {
        const time = performance.now();

        try {
          return await this.redis
            .send<B>(type.name, query)
            .pipe(timeout(5000))
            .toPromise();
        } catch (e) {
          this.logger.error(e);
        } finally {
          const newTime = performance.now();

          if (newTime - time > 1000) {
            this.logger.warn(`${type.name} took ${newTime - time} to finish`);
          }
        }

        return undefined;
      }
    },
  };

  QueryHandler(type)(context[ClassName]);

  return {
    provide: context[ClassName],
    useFactory(core: ClientProxy) {
      return new context[ClassName](core);
    },
    inject: [provide],
  };
}
