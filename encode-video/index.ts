import "reflect-metadata";
import { Context } from "@azure/functions";
import { v4 as uuidv4 } from "uuid";
import { env } from "process";
import container from "./container";
import {
  IAzLoginCredentials,
  IMediaClient,
  IStorageAccountOptions,
} from "./@types/media-client";
import TYPES from "./types";
import { getEnvVar } from "../common";

export default async function blobTrigger(
  context: Context,
  myBlob: { length: number }
): Promise<void> {
  context.log(
    "Blob trigger function processed blob \n Name:",
    context.bindingData.name,
    "\n Blob Size:",
    myBlob.length,
    "Bytes"
  );
  try {
    // Check if all the required env variables are defined.
    // This will throw if any of them are not defined.
    // That's a LOT of env needed. There must be a way to reduce that
    const [
      clientId,
      secret,
      tenant,
      subId,
      rg,
      storageAccountName,
      inputContainer,
      transformName,
      sasUrl,
    ] = [
      "AAD_CLIENT_ID",
      "AAD_SECRET",
      "AAD_TENANT_DOMAIN",
      "SUBSCRIPTION_ID",
      "RESOURCE_GROUP",
      "ACCOUNT_NAME",
      "INPUT_CONTAINER",
      "TRANSFORM_NAME",
      "ACCOUNT_CONNECTION_STRING",
    ].map((env) => getEnvVar<string>(env, context));

    // As there is no true "root" for our DI, we can allow a bit of a service locator anti-pattern.
    const client = container.get<IMediaClient>(TYPES.Media);

    // Enforcing generic here to remind to change the interface for another
    // media client implementation
    await client.login<IAzLoginCredentials>({
      clientId,
      secret,
      tenant,
      subId,
    });

    const storageAccount: IStorageAccountOptions = {
      resourceGroup: rg,
      storageAccount: storageAccountName,
      sasUrl: sasUrl,
    };

    // Set the incoming blob as our source
    await client.setInput(
      context.bindingData.name,
      Object.assign(storageAccount, { container: inputContainer })
    );

    const uuid = uuidv4();
    const outputContainer = `${env.OUTPUT_CONTAINER}-${uuid}`;
    const outputAssetName = `${context.bindingData.name}-${uuid}`;
    const jobName = `job-${uuid}`;
    // Set the target in another container.
    // @Note : Az media services is limited to one asset per container, hence using uuid
    // Using another encoding method (FFMPEG VM ?) this limitation shouldn't apply
    await client.setOutput(
      outputAssetName,
      Object.assign(storageAccount, { container: outputContainer })
    );

    // Set the encoding preset to use to transcode our source into our target
    await client.setEncodingPreset(transformName, storageAccount);

    // Start the encoding process;
    await client.submitJob(jobName, storageAccount);
    context.log.info(
      `Started encoding blob ${context.bindingData.name} from container ${inputContainer} into destination container ${outputContainer} with preset ${transformName}!`
    );
  } catch (e) {
    // Global error handler, needed because stderr doesn't seem to be printed in context
    context.log.error(e);
    throw e;
  }
}
