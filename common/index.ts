import { env } from "process";
import type { Context } from "@azure/functions";

export class MissingEnvError extends Error {}
/**
 * Safely retrieve a var from the environment.
 * Throws if a variable isn't defined and no fallback value is provided
 * @param varName Name of the env variable
 * @param ctx used to issue a warning when a variable isn't defined
 * @param fallback Fallback value
 * @returns the var value of a fallback
 */
export function getEnvVar<T>(varName: string, ctx: Context, fallback?: T): T {
  const envVar = env[varName];
  if (envVar === undefined) {
    if (fallback === undefined) {
      ctx.log.error(
        `Env variable ${varName} isn't defined ! No fallback is provided. Aborting function execution`
      );
      throw new MissingEnvError(`No value provided for variable ${varName}`);
    }
    ctx.log.warn(`${varName} isn't defined ! Defaulting to ${fallback}.`);
    return fallback;
  }
  return envVar as unknown as T;
}
