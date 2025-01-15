import { Injectable } from "@nestjs/common";
import { MatchmakingQueue } from "@/matchmaker/queue/matchmaking.queue";
import { Party } from "@/matchmaker/entity/party";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QueueMeta } from "@/matchmaker/entity/queue-meta";
import { Dota2Version } from "@/gateway/shared-types/dota2version";

@Injectable()
export class DbMatchmakingQueue implements MatchmakingQueue {
  constructor(
    @InjectRepository(Party)
    private readonly pr: Repository<Party>,
    @InjectRepository(QueueMeta)
    private readonly queueMetaRepository: Repository<QueueMeta>,
  ) {}

  async addEntry(entry: Party): Promise<void> {
    await this.pr.save(entry);
  }

  async entries(): Promise<Party[]> {
    return this.pr.find();
  }

  async isLocked(): Promise<boolean> {
    return this.queueMetaRepository
      .findOneOrFail({
        where: { version: Dota2Version.Dota_684 },
      })
      .then((it) => it.isLocked);
  }

  async removeEntries(entry: Party[]): Promise<void> {
    await this.pr.delete(entry.map((it) => it.id));
  }

  async removeEntry(entry: Party): Promise<void> {
    return this.removeEntries([entry]);
  }

  async setLocked(locked: boolean): Promise<void> {
    await this.queueMetaRepository.update(
      {
        version: Dota2Version.Dota_684,
      },
      {
        isLocked: locked,
      },
    );
  }
}
