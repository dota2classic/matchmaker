import { Party } from "@/matchmaker/entity/party";

export interface MatchmakingQueue {
  setLocked(locked: boolean): Promise<void>;
  isLocked(): Promise<boolean>;

  entries(): Promise<Party[]>;
  addEntry(entry: Party): Promise<void>;
  removeEntry(entry: Party): Promise<void>;
  removeEntries(entry: Party[]): Promise<void>;
}
