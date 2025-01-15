import { readFileSync } from "fs";
import * as yaml from "js-yaml";
import { join } from "path";

const YAML_CONFIG_FILENAME = "config.yaml";

export default (filename: string = YAML_CONFIG_FILENAME) => {
  return yaml.load(
    readFileSync(join("./", filename), "utf8"),
  ) as Record<string, any>;
};
