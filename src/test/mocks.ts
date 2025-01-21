import { Constructor, IQuery, IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { Logger } from "@nestjs/common";

export function testMockQuery<T extends IQuery, B>(
  type: Constructor<T>,
  mock: jest.Mock,
): any {
  // Small trick to set class.name dynamically, it is needed for nestjs
  const ClassName = `${type.name}Handler`;
  const context = {
    [ClassName]: class implements IQueryHandler<T, B | undefined> {
      private readonly logger = new Logger(ClassName);
      constructor() {}

      async execute(query: T): Promise<B | undefined> {
        return mock(query);
      }
    },
  };

  QueryHandler(type)(context[ClassName]);

  return {
    provide: context[ClassName],
    useFactory() {
      return new context[ClassName]();
    },
    inject: [],
  };
}
