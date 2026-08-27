import type { Directory } from "./directory/directory";
import type { Mind } from "./mind/mind";

export type Env = {
  AI: Ai;
  MODEL?: string;
  OPERATOR_TOKEN?: string;
  Directory: DurableObjectNamespace<Directory>;
  Mind: DurableObjectNamespace<Mind>;
  ASSETS: Fetcher;
};
