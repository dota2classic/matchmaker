import { Column, Entity, PrimaryColumn } from "typeorm";
import { Dota2Version } from "@/gateway/shared-types/dota2version";

@Entity()
export class QueueMeta {
  @PrimaryColumn()
  version: Dota2Version;

  @Column({ name: "locked", default: false })
  isLocked: boolean;
}
