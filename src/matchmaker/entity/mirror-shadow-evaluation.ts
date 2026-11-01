import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { MirrorInput, MirrorResult } from "@/matchmaker/balance/mirror-shadow";

@Entity("mirror_shadow_evaluation")
export class MirrorShadowEvaluation {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "PK_mirror_shadow_evaluation",
  })
  id: string;

  // No FK to room: ready-check rooms are deleted after resolution.
  @Index("IDX_mirror_shadow_room", { unique: true })
  @Column({ name: "room_id", type: "uuid" })
  roomId: string;

  @Index("IDX_mirror_shadow_created")
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @Column({ type: "jsonb" })
  input: MirrorInput;

  @Column({ type: "jsonb" })
  result: MirrorResult;
}
