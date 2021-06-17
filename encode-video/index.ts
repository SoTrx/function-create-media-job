/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
  AzureMediaServices,
  AzureMediaServicesModels,
} from "@azure/arm-mediaservices";
import {
  BuiltInStandardEncoderPreset,
  JobInputUnion,
  JobOutputAsset,
  JobsCreateResponse,
  TransformsCreateOrUpdateResponse,
  TransformsGetResponse,
} from "@azure/arm-mediaservices/esm/models";

import { Context } from "@azure/functions";
import { loginWithServicePrincipalSecret } from "@azure/ms-rest-nodeauth";
import { v4 as uuidv4 } from "uuid";
import { env } from "process";

export async function blobTrigger(
  context: Context,
  myBlob: any
): Promise<void> {
  context.log(
    "Blob trigger function processed blob \n Name:",
    context.bindingData.name,
    "\n Blob Size:",
    myBlob.length,
    "Bytes"
  );
  let client: AzureMediaServices;
  try {
    client = await getMediaServicesClient();
  } catch (e) {
    context.log.error(
      `Couldn't get the media servcie client. Status Code:${e.statusCode}  Body: ${e.Body}`
    );
    context.log.error(e);
    return;
  }

  try {
    // Ensure that you have the desired encoding Transform. This is really a one time setup operation.
    context.log.info("Creating encoding transform...");

    // Create a new Transform using a preset name from the list of built in encoding presets.
    // To use a custom encoding preset, you can change this to be a StandardEncoderPreset, which has support for codecs, formats, and filter definitions.
    // This sample uses the 'ContentAwareEncoding' preset which chooses the best output based on an analysis of the input video.
    const adaptiveStreamingTransform: BuiltInStandardEncoderPreset = {
      odatatype: "#Microsoft.Media.BuiltInStandardEncoderPreset",
      presetName: "ContentAwareEncoding",
    };

    await ensureTransformExists(
      client,
      context,
      env.TRANSFORM_NAME,
      adaptiveStreamingTransform
    );

    const input = await createInputAsset(
      client,
      context.bindingData.name
    );

    const uuid = uuidv4();
    const outputAssetName = `${context.bindingData.name}-${uuid}`;
    const jobName = `job-${uuid}`;
    context.log.info("Creating the output Asset to encode content into...");
    const outputAsset = await client.assets.createOrUpdate(
      env.RESOURCE_GROUP,
      env.ACCOUNT_NAME,
      outputAssetName,
      {
        container: `${env.OUTPUT_CONTAINER}-${uuid}`,
      }
    );

    if (outputAsset.name !== undefined) {
      context.log.info(
        "Submitting the encoding job to the Transform's job queue..."
      );
      await submitJob(
        client,
        env.TRANSFORM_NAME,
        jobName,
        input,
        outputAsset.name
      );
    }
  } catch (err) {
    context.log.error(err);
  }
}
/**
 * Creates an asset from the provided input container
 * @param client Media services Client
 * @param assetName NAme of the file to use as an asset in the input container
 * @returns
 */
async function createInputAsset(
  client: AzureMediaServices,
  assetName: string
): Promise<JobInputUnion> {
  const inputAsset = await client.assets.createOrUpdate(
    env.RESOURCE_GROUP,
    env.ACCOUNT_NAME,
    assetName,
    {
      container: env.INPUT_CONTAINER,
    }
  );
  return {
    odatatype: "#Microsoft.Media.JobInputAsset",
    assetName: inputAsset.name,
  };
}

/**
 * Tries to log into Media Services
 * @returns media services client
 */
async function getMediaServicesClient(): Promise<AzureMediaServices> {
  const credentials = await loginWithServicePrincipalSecret(
    env.AAD_CLIENT_ID,
    env.AAD_SECRET,
    env.AAD_TENANT_DOMAIN
  );
  return new AzureMediaServices(credentials, env.SUBSCRIPTION_ID);
}

/**
 * Submit a new encoding job
 * @param client media services client
 * @param transformName transform (encoding parameter set to use)
 * @param jobName Encoding job name
 * @param jobInput Input asset
 * @param outputAssetName Name of the output asset to create
 * @returns
 */
async function submitJob(
  client: AzureMediaServices,
  transformName: string,
  jobName: string,
  jobInput: JobInputUnion,
  outputAssetName: string
): Promise<JobsCreateResponse> {
  if (outputAssetName == undefined) {
    throw new Error(
      "OutputAsset Name is not defined. Check creation of the output asset"
    );
  }
  const jobOutputs: JobOutputAsset[] = [
    {
      odatatype: "#Microsoft.Media.JobOutputAsset",
      assetName: outputAssetName,
    },
  ];

  return await client.jobs.create(
    env.RESOURCE_GROUP,
    env.ACCOUNT_NAME,
    transformName,
    jobName,
    {
      input: jobInput,
      outputs: jobOutputs,
    }
  );
}

/**
 * Ensures the provided transform (encoding parameters set) is registered in the
 * Azure media services account. Creates the transforms if it doesn't exists yet.
 * @param client
 * @param context Az function conetx, logging.
 * @param transformName name of the registered transform
 * @param presetDefinition encoding preset to create the transform with
 * @returns created transform
 */
async function ensureTransformExists(
  client: AzureMediaServices,
  context: Context,
  transformName: string,
  presetDefinition: AzureMediaServicesModels.PresetUnion
): Promise<TransformsGetResponse> {
  let transformCreate: TransformsCreateOrUpdateResponse;

  context.log.info("Checking to see if the transform already exists first...");

  const transform = await client.transforms.get(
    env.RESOURCE_GROUP,
    env.ACCOUNT_NAME,
    transformName
  );

  if (!transform.id) {
    context.log.info(
      "Looks like it is not created yet. Creating the new transform."
    );
    try {
      transformCreate = await client.transforms.createOrUpdate(
        env.RESOURCE_GROUP,
        env.ACCOUNT_NAME,
        transformName,
        {
          name: transformName,
          outputs: [
            {
              preset: presetDefinition,
            },
          ],
        }
      );
      context.log.info("Returning new Transform.");
      return transformCreate;
    } catch (err) {
      context.log.error(
        `Error creating the Transform. Status Code:${err.statusCode}  Body: ${err.Body}`
      );
      context.log.error(err);
    }
  }
  context.log.info("Found existing Transform.");

  return transform;
}
